#!/usr/bin/env python
#
# Written by mtyka@google.com (Mike Tyka)
#
# Copyright 2012-2013 Google Inc.
#
# Dual license of MIT license or LGPL3 (the "Licenses")
# MIT license: http://opensource.org/licenses/MIT
# LGPL3: www.gnu.org/licences/lgpl.txt
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licenses is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licenses for the specific language governing permissions and
# limitations under the Licenses.
#

"""CyrusMol: Molecular Modelling and Design App: Serverside code using AppEngine
"""

import webapp2
import datetime
import hashlib
import urllib
import cgi
import jinja2
import os
import json
import logging

__author__ = 'mtyka@google.com (Mike Tyka)'

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))

from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.api import taskqueue

# this test project allows a maximal number of 100 jobs per operation
replication_limit = 100

# data stores and a task queue
structure_list_name = "db_structures"
operation_list_name = "db_operations"
slow_tasks_queue_name = "slow-tasks"

# An operation is defined as any block of replicated jobs. It has a starting structure and
# often has a parent operation
# and a json structure (job_data) 
class Operation(db.Model):
  """Models an operation"""
  # user_id to keep track of the owner
  user_id = db.StringProperty()      
  # keep track of creation time
  created_time = db.DateTimeProperty(auto_now_add=True)
 
  # dbkey of parent operation that was last applied to the starting structure of this operation 
  parentkey = db.StringProperty()
  
  # dbkey of starting structure for this operation 
  structure_key = db.StringProperty()
  
  # hash of starting structure for this operation 
  structure_hash = db.StringProperty()

  # how many jobs to be executed
  replication = db.StringProperty()
  
  # JSON structure of input paramenters 
  job_data = db.BlobProperty()

  # Human readable description of operation (ignored by computers)
  info = db.StringProperty()

  # results statistics:
  # how many jobs have returned
  count_results = db.IntegerProperty()
  
  # how many jobs failed
  count_errors = db.IntegerProperty()
  
  # how much CPU time in seconds has accumulated
  count_cputime = db.IntegerProperty()
  
  # last error that came in
  last_stderr = db.TextProperty()

def operation_key(operation_name=None):
  """Constructs a Datastore key for a Operation entity with operation_name."""
  return db.Key.from_path('Operation', operation_name or 'default_operation')




# The "Structure" class holds a molecular system, molecule or other complete simulation environment
class Structure(db.Model):
  """Models an individual structure"""
  # user_id to keep track of the owner
  user_id = db.StringProperty()
  # keep track of when this was created
  created_time = db.DateTimeProperty(auto_now_add=True)

  # SHA1 hash of the pdbdata - used to verify and compare structures
  hash = db.StringProperty()
  # Database key of the parent structure (if in database)
  parental_key = db.StringProperty()
  # SHA1 hash of the parent structure (if knwon)
  parental_hash = db.StringProperty()
  # Database key of the operation that created this structure
  operation = db.StringProperty()
  
  # Taskname of the individual job that created this structure. THis and the
  taskname = db.StringProperty()
  # And the queue name name
  queuename = db.StringProperty()

  # Wallclock time of worker to create this structure
  cpuseconds = db.IntegerProperty()
  # information about the worker node
  workerinfo = db.TextProperty()
  # the molecular coordinate data of this structure in PDB format (text)
  pdbdata = db.BlobProperty()
  # 0 if no error, !=0 otherwise. This is returned by the worker nodes
  error = db.IntegerProperty()
  # Any error messages fromt the worker
  stderr = db.TextProperty()
  # JSON structure of energies and other data from the worker nodes about the structure
  energies = db.BlobProperty()

def structure_key(structure_name=None):
  """Constructs a Datastore key for a Structure entity with structure_name."""
  return db.Key.from_path('Structure', structure_name or 'default_structure')

def admin_required( func ):
  """Decorator function - checks if current user is admin"""
  def check_auth( self, *args, **kwargs ):
    if not users.is_current_user_admin():
      user = users.get_current_user()
      logging.warning( "Not Admin!:" + str(user.email()) )
      self.response.set_status(403)
      self.response.out.write("Forbidden - admin only")
    else:
      # if user is ok, return to caller !
      return func( self, *args, **kwargs )
  return check_auth

def login_required( func ):
  """Decorator function stub - can be used to check if current user is registered""" 
  def check_auth( self, *args, **kwargs ):
    # Figure out if this user is registered
    user = users.get_current_user()
    # does this user already have an account?
    logging.info( "<" + user.email() + ">" )
    try:
      # for now allow all users
      result = True

      # check userdatabase here. 
      # If this throws an exception or
      # sets result to false user will be redirected to registration page
      if not result:
        raise Exception('Unknown user')

    except:
      # redirect to registration page !
      self.redirect("/register")
      return

    # if user is ok, return to caller !
    return func( self, *args, **kwargs )
  return check_auth

def return_server_error(self):
  self.response.set_status(500)
  self.response.out.write("")
  return
  

class MainPage(webapp2.RequestHandler):

  @login_required
  def get(self):
    """Delivers main page content (index.html)"""
    user = users.get_current_user()
    # grab template file and a few basic values and send out response
    template = jinja_environment.get_template('index.html')
    template_values = [("log",str(dir( taskqueue ))), 
                       ("logout_url",users.create_logout_url("/")), 
                       ("user",user.email()), 
                       ("user_id",user.user_id())]
    self.response.out.write(template.render(template_values))

class Task_Add(webapp2.RequestHandler):
  @login_required
  def post(self):
    """Deal with request to queue up a new operation"""
    
    user = users.get_current_user()
    
    # get replication parameter from URL
    replication = int( self.request.get('replication') )

    # right now replication is limited to a maximum of replication_limit jobs.
    if replication > replication_limit: replication = replication_limit;
    # less then 1 jobs no maky any sensy
    if replication < 1: replication = 1;

    # get parental_key and hash from URL also
    parental_key  = self.request.get('parental_key')
    parental_hash = self.request.get('parental_hash')

    # the actual job data is sent by the client in the body of the POST as a JSON string
    job_data = self.request.body
    
    # interpret the JSON structure
    job_data_json = json.loads( job_data )

    # calculate a SHA1 hash of the pdb data. This is for tracking and comparison
    pdbhash =  hashlib.sha1(job_data).hexdigest()

    # set up a new operation data block and set some reasonable initial values
    new_operation                = Operation(parent=operation_key( operation_list_name ))
    new_operation.user_id        = user.user_id()
    new_operation.structure_key  = "" 
    new_operation.structure_hash = pdbhash
    new_operation.replication    = str(replication)
    new_operation.parentkey      = job_data_json["parent_operation"]
    new_operation.job_data       = job_data
    new_operation.info           = json.dumps( job_data_json[ "operation_info" ] )
    new_operation.count_results  = 0
    new_operation.count_errors   = 0
    new_operation.count_cputime  = 0
    new_operation.last_stderr    = ""
    
    # Add the operation to the GAE data store
    new_operation.put()
    
    # Also create a data entry for the structure itself
    newstructure            = Structure(parent=structure_key( structure_list_name ))
    newstructure.user_id    = user.user_id()
    newstructure.workerinfo = ""
    newstructure.pdbdata    = str(job_data_json["pdbdata"])
    newstructure.hash       = pdbhash
    newstructure.operation  = str( new_operation.key() )

    # Add the structure to the GAE data store
    newstructure.put()

    # finally create all the compute tasks. We're highjacking the task queue
    # system the GAE provides but we're not actually letting GAE *execute* these.
    # instead we let worker clients take jobs off the top of the queue and return data
    # via HTTP
    taskdata = { "key"     : str(newstructure.key()),
                 "hash"    : newstructure.hash,
                 "user_id" : user.user_id(),
                 "operation" : newstructure.operation,
                 "job_data" : job_data }
    tasks = []
    for r in range(replication):
      newtask = taskqueue.Task(payload=json.dumps(taskdata), method='PULL')
      tasks.append( newtask )

    # make the task queue for these jobs
    q = taskqueue.Queue(slow_tasks_queue_name)
    # Now add all the tasks
    q.add(tasks)



class Task_Get(webapp2.RequestHandler):
  def post(self):
    """Takes a task off the top of the queue and leases it"""
    q = taskqueue.Queue(slow_tasks_queue_name)

    lease_time = self.request.get('lease_time')

    # for now only let 1 task be taken at a time.
    tasks = q.lease_tasks(int(lease_time), 1)

    # check if there are any tasks to be done, otherwise
    # hand back a JSON structure with all the necessary job information
    if len(tasks) == 0:
      self.response.out.write( "[]" )
    else:
      t = {
        "method":         str(tasks[0].method),
        "name":           str(tasks[0].name),
        "payload":        str(tasks[0].payload),
        "queue_name":     str(tasks[0].queue_name),
        "retry_options":  str(tasks[0].retry_options),
        "size":           str(tasks[0].size),
        "tag":            str(tasks[0].tag),
        "was_deleted":    str(tasks[0].was_deleted),
        "was_enqueued":   str(tasks[0].was_enqueued)
       }

      #finally reply ot the request
      self.response.out.write( json.dumps(t) )


def delete_task_by_name( taskname, queuename = slow_tasks_queue_name):
    """Helper function that deletes a task given  taskname""" 
    q = taskqueue.Queue( queuename )
    faketask = type('faketask', (object,),  {"name": taskname, "was_deleted": False } )()
    q.delete_tasks( faketask )

class Task_Delete(webapp2.RequestHandler):
  @login_required
  def post(self):
    """Delete a particular task"""
    taskname = self.request.get('taskname')
    delete_task_by_name( taskname )

class Task_Purgeall(webapp2.RequestHandler):
  @login_required
  def post(self):
     """Deletes all the tasks"""
     q = taskqueue.Queue(slow_tasks_queue_name)
     q.purge()

class Task_List(webapp2.RequestHandler):
  @login_required
  def get(self):
    """Mainly for diagnostics: Lists up to 100 next tasks"""
    q = taskqueue.Queue(slow_tasks_queue_name)

    #there is no pythonic way to get a list of tasks, this can only be done via 
    #REST API so we have to cheat - just lease the tasks for 0 second. At least 
    #show all the unleased task this way.
    tasks = q.lease_tasks(0, 100)

    tasklist = [
     {
      "method":         str(t.method),
      "name":           str(t.name),
      "payload":        str(t.payload),
      "queue_name":     str(t.queue_name),
      "retry_options":  str(t.retry_options),
      "size":           str(t.size),
      "tag":            str(t.tag),
      "was_deleted":    str(t.was_deleted),
      "was_enqueued":   str(t.was_enqueued)
     }
     for t in tasks]

    self.response.out.write( json.dumps(tasklist) )


class Structure_List(webapp2.RequestHandler):
  @login_required
  def get(self):
    """Obtain a list of structures"""

    user = users.get_current_user()

    structure_query =  Structure.all()
    structure_query.ancestor( structure_key( structure_list_name ))
    structure_query.filter("user_id =", user.user_id() )
    structure_query.order('created_time')
    
    structures=[ { 
        "key":str(structure.key()),
        "created_time":str(structure.created_time),
        "parental_hash":str(structure.parental_hash),
        "parental_key":str(structure.parental_key),
        "hash":str(structure.hash),
        "user_id":str(structure.user_id),
        "taskname":str(structure.taskname),
        "queuename":str(structure.queuename),
        "workerinfo":str(structure.workerinfo),
        "energies":str(structure.energies),
        "stderr":str(structure.stderr)
      } for structure in structure_query.run() ]

    self.response.out.write(json.dumps(structures) )


class Structure_Put(webapp2.RequestHandler):
  # no login required here because the workers are anonymous. However we
  # do do a check to make sure this task actually existed by comparing hashes. 
  # If not we simply ignore the request.
  # TODO: Actualy token authentication for the workers.

  def post(self):
    """Add a structure to the database. This is called by the workers"""
    # get the task queue so we can delete the relevant task
    q = taskqueue.Queue(slow_tasks_queue_name)
    payload = self.request.get('output')
    payload_json = urllib.unquote_plus( payload )
    payload_data = json.loads( payload_json )

    # First make sure the taskname is in the payload data
    if not "taskname" in payload_data:
      return return_server_error(self)

    # First delete the task that has been completed
    delete_task_by_name(payload_data["taskname"])

    self.response.out.write("Success" );

    newstructure = Structure(parent=structure_key( structure_list_name ))

    newstructure.user_id        = str(payload_data["user_id"])
    newstructure.error          = int(payload_data["error"])
    newstructure.workerinfo     = str(payload_data["workerinfo"])
    newstructure.pdbdata        = str(payload_data["pdbdata"])
    newstructure.parental_key   = str(payload_data["parental_key"])
    newstructure.parental_hash  = str(payload_data["parental_hash"])
    newstructure.operation      = str(payload_data["operation"])
    if "energies" in payload_data:
      newstructure.energies       = json.dumps(payload_data["energies"])
    else:
      newstructure.energies       = "[]"
    newstructure.stderr         = str( payload_data["stderr"] )
    newstructure.hash = hashlib.sha1(newstructure.pdbdata).hexdigest()
    newstructure.put()

    # now update the operation (we could cache here and update only every so often if we wanted to minimize db access)

    operation = db.get( str(payload_data["operation"] ) )
    operation.count_results   = (operation.count_results or 0) + 1
    if int(payload_data["error"]) != 0:
      operation.count_errors   = (operation.count_errors or 0) + 1
    operation.count_cputime    += int( payload_data["cputime"] )
    if str(payload_data["stderr"]) != "":
      operation.last_stderr      = str( payload_data["stderr"] )
    operation.put()

class Structure_Get(webapp2.RequestHandler):
  @login_required
  def get(self):
    """Obtain a particular structure based on a key"""

    key = self.request.get('key')
    try:
      structure = db.get( key )
      # Check that this user matches the owner of the object
      user = users.get_current_user()
      if user.user_id() != structure.user_id:
        self.response.set_status(403)
        return
      structure_dict = {
        "key" : str(structure.key()) ,
        "user_id" :str(structure.user_id) ,
        "created_time" :str(structure.created_time) ,
        "parental_hash" :str(structure.parental_hash),
        "parental_key" :str(structure.parental_key) ,
        "operation" :str(structure.operation) ,
        "hash" :str(structure.hash) ,
        "taskname" :str(structure.taskname) ,
        "queuename" :str(structure.queuename) ,
        "pdbdata" :str(structure.pdbdata) ,
        "stderr" :str(structure.stderr) ,
        "energies" :str(structure.energies) ,
        "workerinfo" :str(structure.workerinfo)
      }
      # reply with JSON object
      self.response.out.write( json.dumps( structure_dict ) )
      return

    except:
      self.response.set_status(500)
      self.response.out.write("")
      return


# delete a particular structure 
class Structure_Delete(webapp2.RequestHandler):
  @login_required
  def post(self):
    """Deletes a structure with a particular database key"""
    structure = db.get( self.request.get('key') )

    # Check that this user matches the owner of the object
    user = users.get_current_user()
    if user.user_id != structure.user_id:
      self.response.set_status(403)
      return

    # or else continue to deleteing this structure
    structure.delete()

# deletes all structures of the current user  flat out or flat out or  
class Structure_DeleteAll(webapp2.RequestHandler):
  @login_required
  def post(self):
    """Delete all structures derived from a parental_hash or parental_key"""
    #grab url parameters
    parental_hash = self.request.get('parental_hash')
    parental_key  = self.request.get('parental_key')
    user = users.get_current_user()
    structure_query =  Structure.all()
    structure_query.ancestor( structure_key( structure_list_name ))
    #if client wants only a particular parental hash - make it so
    if parental_hash:  
      structure_query.filter("parental_hash =", parental_hash )
    
    #if client wants only a particular parental_key - make it so
    if parental_key:   
      structure_query.filter("parental_key =", parental_key )
    
    #always filter by user of course
    structure_query.filter("user_id =", user.user_id() )
    
    for structure in structure_query.run():
      structure.delete()

# returns a json object with all the structures that match a particular query. 
# this could be a lot of data - need to implement a way to get chunks of it. For now return it all 
class Structure_Query(webapp2.RequestHandler):
  @login_required
  def get(self):
    """Get a list of structures derived from a parental_hash or parental_key"""

    user = users.get_current_user()
    parental_hash = self.request.get('parental_hash')
    parental_key  = self.request.get('parental_key')
    structure_data = []

    try:
      structure_query = Structure.all()
      structure_query.ancestor( structure_key( structure_list_name ))
      
      #if client wants only a particular parental hash - make it so
      if parental_hash:  
        structure_query.filter("parental_hash =", parental_hash )
      
      #if client wants only a particular parental_key - make it so
      if parental_key:   
        structure_query.filter("parental_key =", parental_key )
      
      #always filter by user of course
      structure_query.filter("user_id =", user.user_id() )
     
      structure_data = [ {
          "key" : str(structure.key()),
          "created_time" :str(structure.created_time) ,
          "parental_hash" :str(structure.parental_hash) ,
          "parental_key" :str(structure.parental_key) ,
          "hash" :str(structure.hash) ,
          "operation" :str(structure.operation) ,
          "taskname" :str(structure.taskname) ,
          "queuename" :str(structure.queuename) ,
          #do not pass pack the pdb data - that's way to much data - client must retrieve
          #that one by one
          #"pdbdata" :str(structure.pdbdata) ,
          "stderr" :str(structure.stderr) ,
          "energies" :str(structure.energies) ,
          "workerinfo" :str(structure.workerinfo)
        } for structure in structure_query.run() ]
  
      # finally return a json version of our data structure
      self.response.out.write( json.dumps( structure_data ) )
    except:
      return return_server_error( self )



class Operation_List(webapp2.RequestHandler):
  @login_required
  def get(self):
    """Obtains a JSON list of all the operations in the database (of this user)"""
    user = users.get_current_user()
    parentkey = self.request.get('parentkey')
    operation_data = []
    
    try:
      operations_query = Operation.all()
      operations_query.filter("parentkey =",parentkey)
      operations_query.filter("user_id =",user.user_id())
      
      
      operation_data = [ {
          "key": str(operation.key()),
          "parentkey": str(operation.parentkey),
          "structure_key": str(operation.structure_key),
          "structure_hash": str(operation.structure_hash),
          "replication": str(operation.replication),
          "count_results": str(operation.count_results),
          "count_errors": str(operation.count_errors),
          "count_cputime": str(operation.count_cputime),
          "last_stderr": str(operation.last_stderr),
          "job_data": str(operation.job_data),
          "info": operation.info,
        } for operation in operations_query.run() ]
      self.response.out.write( json.dumps( operation_data ) )
    except: 
      return return_server_error( self )


class Operation_DeleteAll(webapp2.RequestHandler):
  @login_required
  def post(self):
    """Delete all the operations entries in the database (of this user)"""
    user = users.get_current_user()

    operations_query = Operation.all().ancestor( operation_key( operation_list_name ))
    operations_query.filter("user_id =", user.user_id() )
    for operation in operations_query.run(): 
      operation.delete()

app = webapp2.WSGIApplication([
  ('/',                      MainPage ),
  ('/task/add',              Task_Add ),
  ('/task/get',              Task_Get ),
  ('/task/delete',           Task_Delete ),
  ('/task/purgeall',         Task_Purgeall ),
  ('/task/list',             Task_List ),
  ('/structure/list',        Structure_List ),
  ('/structure/put',         Structure_Put ),
  ('/structure/get',         Structure_Get ),
  ('/structure/query',       Structure_Query ),
  ('/structure/delete',      Structure_Delete ),
  ('/structure/deleteall',   Structure_DeleteAll ),
  ('/operation/list',        Operation_List ),
  ('/operation/deleteall',   Operation_DeleteAll ),

 ], debug=True)
