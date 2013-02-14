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

replication_limit = 10
account_list_name = "db_allowe_account_list"
structure_list_name = "db_structures"
operation_list_name = "db_operations"
slow_tasks_queue_name = "slow-tasks"

class Account(db.Model):
  name = db.StringProperty()

def account_key(account_name=None):
  """Constructs a Datastore key for a Account entity with account_name."""
  return db.Key.from_path('Account', account_name or 'default_account')

class Operation(db.Model):
  """Models an operation"""
  user_id          = db.StringProperty()
  created_time     = db.DateTimeProperty(auto_now_add=True)

  parentkey = db.StringProperty()
  structure_key    = db.StringProperty()
  structure_hash   = db.StringProperty()
  replication      = db.StringProperty()
  job_data         = db.BlobProperty()
  info             = db.StringProperty()
  count_results    = db.IntegerProperty()
  count_errors     = db.IntegerProperty()
  count_cputime    = db.IntegerProperty()
  last_stderr      = db.TextProperty()




def operation_key(operation_name=None):
  """Constructs a Datastore key for a Operation entity with operation_name."""
  return db.Key.from_path('Operation', operation_name or 'default_operation')


class Structure(db.Model):
  """Models an individual structure"""
  user_id        = db.StringProperty()
  created_time   = db.DateTimeProperty(auto_now_add=True)

  hash           = db.StringProperty()
  parental_key   = db.StringProperty()
  parental_hash  = db.StringProperty()
  operation      = db.StringProperty()
  taskname       = db.StringProperty()
  queuename      = db.StringProperty()
  author         = db.StringProperty()
  eta            = db.StringProperty()
  cpuseconds     = db.IntegerProperty()
  workerinfo     = db.TextProperty()
  pdbdata        = db.BlobProperty()
  error          = db.IntegerProperty()
  stderr         = db.TextProperty()
  energies       = db.BlobProperty()

def structure_key(structure_name=None):
  """Constructs a Datastore key for a Structure entity with structure_name."""
  return db.Key.from_path('Structure', structure_name or 'default_structure')

class Register(webapp2.RequestHandler):
  def get(self):
    user = users.get_current_user()
    template = jinja_environment.get_template('noaccount.html')
    template_values = [ ( "user", user.email() ), ( "logout_url", users.create_logout_url("/") ) ]
    self.response.out.write(template.render(template_values))

def admin_required( func ):
  def check_auth( self, *args, **kwargs ):
    if not users.is_current_user_admin():
      ## redirect to registration page !
      user = users.get_current_user()
      logging.warning( "Not Admin!:" + str(user.email()) )
      self.response.set_status(403)
      self.response.out.write("Forbidden - admin only")
    else:
      # if user is ok, return to caller !
      return func( self, *args, **kwargs )
  return check_auth

def login_required( func ):
  def check_auth( self, *args, **kwargs ):
    ## Figure out if this user is registered
    user = users.get_current_user()
    # does this user already have an account?
    logging.info( "<" + user.email() + ">" )
    try:
      accounts = Account.all()
      accounts.filter("name =", user.email().lower() )
      result = accounts.fetch(10)
      if not result:
        raise Exception('Unknown user')

    except:
      ## redirect to registration page !
      self.redirect("/register")
      return

    # if user is ok, return to caller !
    return func( self, *args, **kwargs )
  return check_auth


class MainPage(webapp2.RequestHandler):

  @login_required
  def get(self):
    ## Figure out if this user is registered
    user = users.get_current_user()
    #logging.info( [ user.auth_domain(), user.email(), user.federated_identity(), user.federated_provider(), user.nickname() , user.user_id() ] )
    template = jinja_environment.get_template('index.html')
    template_values = [ ("log", str(dir( taskqueue ))), ( "logout_url", users.create_logout_url("/") ), ("user", user.email() ), ( "user_id", user.user_id() )  ]
    self.response.out.write(template.render(template_values))

class User_Add(webapp2.RequestHandler):
  @admin_required
  def get(self):
    template = jinja_environment.get_template('adduser.html')
    accountsquery = Account.all().order('name')
    accounts       = accountsquery.fetch(1000)

    template_values = {
        'accounts': accounts
    }
    self.response.out.write(template.render(template_values))

  @admin_required
  def post(self):
    username = self.request.get('email')
    account= Account(parent=account_key( account_list_name ))
    #Lowercase the user email address so later comparisons can be case independent
    account.name=username.lower()
    account.put()
    self.redirect( "/user/add" )

class User_Delete(webapp2.RequestHandler):
  @admin_required
  def post(self):
    account = db.get( self.request.get('key') )
    account.delete()

class Task_Add(webapp2.RequestHandler):
  @login_required
  def post(self):
    tasks = []
    user = users.get_current_user()
    replication = int( self.request.get('replication') )

    ## right now replication is limited to a maximum of replication_limit jobs.
    if replication > replication_limit: replication = replication_limit;
    ## less then 1 jobs no maky any sensy
    if replication < 1: replication = 1;

    parental_key  = self.request.get('parental_key')
    parental_hash = self.request.get('parental_hash')

    job_data = self.request.body

    job_data_json = json.loads( job_data )
    #logging.info( str( job_data ) )

    pdbhash =  hashlib.sha1(job_data).hexdigest()

    ## set up operation
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
    new_operation.put()


    ## make the task queue for these jobs
    q = taskqueue.Queue(slow_tasks_queue_name)

    newstructure            = Structure(parent=structure_key( structure_list_name ))
    newstructure.user_id    = user.user_id()
    newstructure.workerinfo = ""
    newstructure.pdbdata    = str(job_data_json["pdbdata"])
    newstructure.hash       = pdbhash
    newstructure.operation  = str( new_operation.key() )

    if users.get_current_user():
      newstructure.author = users.get_current_user().nickname()
    newstructure.put()

    taskdata = { "key"     : str(newstructure.key()),
                 "hash"    : newstructure.hash,
                 "user_id" : user.user_id(),
                 "operation" : newstructure.operation,
                 "job_data" : job_data }

    for r in range(replication):
      newtask = taskqueue.Task(payload=json.dumps(taskdata), method='PULL')
      tasks.append( newtask )

    # Now add all the tasks
    q.add(tasks)



class Task_Get(webapp2.RequestHandler):
  def post(self):
    q = taskqueue.Queue(slow_tasks_queue_name)

    lease_time = self.request.get('lease_time')

    tasks = q.lease_tasks(int(lease_time), 1)
    if len(tasks) == 0:
      self.response.out.write( "[]" )
    else:
      t = {
        "eta":            str(tasks[0].eta),
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

      self.response.out.write( json.dumps(t) )


def delete_task_by_name( taskname, queuename = slow_tasks_queue_name):
    q = taskqueue.Queue( queuename )
    faketask = type('faketask', (object,),  {"name": taskname, "was_deleted": False } )()
    q.delete_tasks( faketask )

class Task_Delete(webapp2.RequestHandler):
  @login_required
  def post(self):
    taskname = self.request.get('taskname')
    delete_task_by_name( taskname )

class Task_Purgeall(webapp2.RequestHandler):
  @login_required
  def post(self):
     q = taskqueue.Queue(slow_tasks_queue_name)
     q.purge()

class Task_List(webapp2.RequestHandler):
  @login_required
  def get(self):
    q = taskqueue.Queue(slow_tasks_queue_name)

    #there is no pythonic way to get a list of tasks, this can only be done via REST API (wtf google ? ) so we have to cheat - just lease the tasks for 1 second. At least show all the unleased task this way.
    tasks = q.lease_tasks(0, 100)

    tasktemplate  = jinja_environment.get_template('task_list.html')
    tasktemplate_values = [
     {
      "eta":            str(t.eta),
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

    self.response.out.write( json.dumps(tasktemplate_values) )


class Structure_List(webapp2.RequestHandler):
  @login_required
  def get(self):
    user = users.get_current_user()

    structures_query =  Structure.all()
    structures_query.ancestor( structure_key( structure_list_name ))
    structures_query.filter("user_id =", user.user_id() )
    structures_query.order('created_time')
    structures       = structures_query.fetch(1000)

    #logging.info( structures )

    template  = jinja_environment.get_template('structurelist.html')
    template_values = {
        'structures': structures
    }
    self.response.out.write(template.render(template_values))

class Structure_Put(webapp2.RequestHandler):
  # no login required here because the workers are anonymous. However we
  # do do a check to make sure this task actually existed. If not we
  # simply ignore the request.
  def return_error(self):
    pass

  def post(self):

    # get the task queue so we can delete the relevant task
    q = taskqueue.Queue(slow_tasks_queue_name)

    payload = self.request.get('output')
    payload_json = urllib.unquote_plus( payload )
    #logging.info("Payload json is: !!!%s!!!", str(payload_json))
    payload_data = json.loads( payload_json )

    ## First make sure the taskname is in the payload data
    if not "taskname" in payload_data:
      return return_error()

    ## First delete the task that has been completed
    #logging.info("Deleting completed task: <%s>" % payload_data["taskname"] )

    delete_task_by_name(payload_data["taskname"])

    self.response.out.write("Success" );

    newstructure = Structure(parent=structure_key( structure_list_name ))

    #logging.info( payload_data.keys() )

    newstructure.user_id        = str(payload_data["user_id"])
    newstructure.error          = int(payload_data["error"])
    newstructure.workerinfo     = str(payload_data["workerinfo"])
    newstructure.pdbdata        = str(payload_data["pdbdata"])
    newstructure.parental_key   = str(payload_data["parental_key"])
    newstructure.parental_hash  = str(payload_data["parental_hash"])
    newstructure.operation      = str(payload_data["operation"])
    newstructure.energies       = json.dumps(payload_data["energies"])
    newstructure.stderr         = str( payload_data["stderr"] )

    if users.get_current_user():
      newstructure.author = users.get_current_user().nickname()
    newstructure.hash = hashlib.sha1(newstructure.pdbdata).hexdigest()

    newstructure.put()

    ## now update the operation (we could cache here and update only every so often if we wanted to minimize db access)

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

    key = self.request.get('key')
    structure = db.get( key )

    ## Check that this user matches the owner of the object
    user = users.get_current_user()
    if user.user_id() != structure.user_id:
      self.response.set_status(403)
      return


    structure_dict = {
    "key" :          str(structure.key())        ,
    "user_id"       :str(structure.user_id)      ,
    "created_time"  :str(structure.created_time) ,
    "parental_hash" :str(structure.parental_hash),
    "parental_key"  :str(structure.parental_key) ,
    "operation"     :str(structure.operation)    ,
    "hash"          :str(structure.hash)         ,
    "taskname"      :str(structure.taskname)     ,
    "queuename"     :str(structure.queuename)    ,
    "author"        :str(structure.author)       ,
    "eta"           :str(structure.eta)          ,
    "pdbdata"       :str(structure.pdbdata)      ,
    "stderr"        :str(structure.stderr)       ,
    "energies"      :str(structure.energies)     ,
    "workerinfo"    :str(structure.workerinfo)
    }

    ## TODO Need error handlign code here

    #logging.info("Got Structure: %s"%str( structure_dict ) )

    # reply with JSON object
    self.response.out.write( json.dumps( structure_dict ) )

class Structure_Delete(webapp2.RequestHandler):
  @login_required
  def post(self):
    structure = db.get( self.request.get('key') )

    ## Check that this user matches the owner of the object
    user = users.get_current_user()
    if user.user_id != structure.user_id:
      self.response.set_status(403)
      return

    ## or else continue to deleteing this structure
    structure.delete()

class Structure_DeleteAll(webapp2.RequestHandler):
  @login_required
  def post(self):
    user = users.get_current_user()
    structures_query = Structure.all().ancestor( structure_key( structure_list_name ))
    structures_query.filter( "user_id = ", user.user_id)
    #delete them in blocks of 1000
    while True:
      structures       = structures_query.fetch(1000)
      if not structures:
        break
      for structure in structures:
        structure.delete()

class Structure_Query(webapp2.RequestHandler):
  @login_required
  def get(self):
    ### returns a json object with all the structures that match a particular query.

    user = users.get_current_user()
    parental_hash = self.request.get('parental_hash')
    parental_key  = self.request.get('parental_key')

    structures = []
    try:
      structures = Structure.all()

      if parental_hash:  structures.filter("parental_hash =", parental_hash )
      if parental_key:   structures.filter("parental_key =", parental_key )
      structures.filter("user_id =", user.user_id() )
      structures.fetch(1000)
    except:
      structures = []

    structure_data = []
    for structure in structures:
      structure_dict = {
      "key" :          str(structure.key()),
      "created_time"  :str(structure.created_time)  ,
      "parental_hash" :str(structure.parental_hash) ,
      "parental_key"  :str(structure.parental_key)  ,
      "hash"          :str(structure.hash)          ,
      "operation"     :str(structure.operation)          ,
      "taskname"      :str(structure.taskname)      ,
      "queuename"     :str(structure.queuename)     ,
      "author"        :str(structure.author)        ,
      "eta"           :str(structure.eta)           ,
      ##"pdbdata"      :str(structure.pdbdata)      ,
      "stderr"        :str(structure.stderr)        ,
      "energies"      :str(structure.energies)      ,
      "workerinfo"    :str(structure.workerinfo)
      }
      structure_data.append( structure_dict )

    self.response.out.write( json.dumps( structure_data ) )


def UpdateComplettionTasks( operation_key ):
    operation = db.get( operationkey )

    structures = Structure.all()
    structures.filter("operation =", operation_key )
    total_results = structures.count( read_policy= EVENTUAL_CONSISTENCY, deadline=5 )
    structures.filter("error_status =", 0)
    good_results = structures.count( read_policy= EVENTUAL_CONSISTENCY, deadline=5 )



    self.response.out.write( json.dumps( structure_data ) )



class Operation_GetStats(webapp2.RequestHandler):
  @login_required
  def post(self):
    user = users.get_current_user()
    operationkey = self.request.get('key')

    operation = db.get( operationkey )

    ## Check that this user matches the owner of the object
    user = users.get_current_user()
    if user.user_id != operation.user_id:
      self.response.set_status(403)
      return




class Operation_List(webapp2.RequestHandler):
  @login_required
  def get(self):
    user = users.get_current_user()
    parentkey = self.request.get('parentkey')
    operations = []
    try:
      operations = Operation.all()
      operations.filter("parentkey =", parentkey )
      operations.filter("user_id =", user.user_id() )
      operations.fetch(1000)
    except:
      operations = []

    operation_data = []
    for operation in operations:
      operation_dict = {
      "key"               : str(operation.key()),
      "parentkey"         : str(operation.parentkey)  ,
      "structure_key"     : str(operation.structure_key   )  ,
      "structure_hash"    : str(operation.structure_hash  )  ,
      "replication"       : str(operation.replication     )  ,
      "count_results"     : str(operation.count_results   )  ,
      "count_errors"      : str(operation.count_errors    )  ,
      "count_cputime"     : str(operation.count_cputime  )  ,
      "last_stderr"       : str(operation.last_stderr     )  ,
      "job_data"          : str(operation.job_data     )  ,
      "info"              : operation.info   ,
      }
      operation_data.append( operation_dict )

    self.response.out.write( json.dumps( operation_data ) )

class Operation_DeleteAll(webapp2.RequestHandler):
  @login_required
  def post(self):
    user = users.get_current_user()

    operations_query = Operation.all().ancestor( operation_key( operation_list_name ))
    operations_query.filter("user_id =", user.user_id() )
    #delete them in blocks of 1000
    while True:
      operations       = operations_query.fetch(1000)
      if not operations:
        break
      for operation in operations:
        operation.delete()

app = webapp2.WSGIApplication([
  ('/',                      MainPage ),
  ('/register',              Register ),
  ('/user/add',              User_Add ),
  ('/user/delete',           User_Delete ),
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
  ('/operation/getstats',    Operation_GetStats ),
  ('/operation/list',        Operation_List ),
  ('/operation/deleteall',   Operation_DeleteAll ),

 ], debug=True)
