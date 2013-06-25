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

"""Defines the 'Structure' data model.

"""
import hashlib
import urllib 
import httplib
import json
import webapp2

from google.appengine.api import users
from google.appengine.ext import db

import common
import task
import operation

structure_list_name = 'db_structures'


class Structure(db.Model):
  """Models a molecular structure or system.

     user_id:  user_id to keep track of the owner
     created_time:  keep track of when this was created
     hash_sha1:  SHA1 hash of the pdbdata - used to verify and compare
                 structures
     parental_key:  Database key of the parent structure (if in database)
     parental_hash:  SHA1 hash of the parent structure (if knwon)
     structure:  Database key of the structure that created this structure
     taskname:  Taskname of the individual job that created this structure.
     queuename:  The name of the taskqueue this structure came from
     cpuseconds:  Wallclock time of worker to create this structure
     workerinfo:  information about the worker node
     pdbdata:  he molecular coordinate data of this structure in PDB format
     stderr:  Any error messages fromt the worker
     energies:  JSON structure of energies and other data from the worker
                nodes about the structure
  """

  user_id = db.StringProperty()
  created_time = db.DateTimeProperty(auto_now_add=True)
  hash_sha1 = db.StringProperty()
  parental_key = db.StringProperty()
  parental_hash = db.StringProperty()
  operation = db.StringProperty()
  taskname = db.StringProperty()
  queuename = db.StringProperty()
  cpuseconds = db.IntegerProperty()
  workerinfo = db.TextProperty()
  pdbdata = db.BlobProperty()
  stderr = db.TextProperty()
  energies = db.BlobProperty()

  @classmethod
  def Key(cls, structure_name):
    """Constructs a Datastore key for a Structure entity with structure_name."""
    return db.Key.from_path('Structure', structure_name)

  def AsDict(self, include_pdbdata=False):
    """Returns data in dictionary form."""
    dform = {
        'key': str(self.key()),
        'created_time': str(self.created_time),
        'parental_hash': str(self.parental_hash),
        'parental_key': str(self.parental_key),
        'operation': str(self.operation),
        'hash_sha1': str(self.hash_sha1),
        'user_id': str(self.user_id),
        'taskname': str(self.taskname),
        'queuename': str(self.queuename),
        'cpuseconds': self.cpuseconds,
        'workerinfo': str(self.workerinfo),
        'energies': str(self.energies),
        'stderr': str(self.stderr)
        }

    if include_pdbdata: dform['pdbdata'] = str(self.pdbdata)
    return dform


class List(common.RequestHandler):
  ROUTE = '/structure/list'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['GET'])]

  @common.RequestHandler.LoginRequired
  def get(self):   # pylint: disable=g-bad-name
    """Obtain a list of structures."""
    user = users.get_current_user()

    structure_query = Structure.all()
    structure_query.ancestor(Structure.Key(structure_list_name))
    structure_query.filter('user_id =', user.user_id())
    structure_query.order('created_time')

    structures = [structure.AsDict() for structure
                  in structure_query.run()]

    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['Content-Disposition'] = 'attachment'
    self.response.out.write(json.dumps(structures))


class Get(common.RequestHandler):
  ROUTE = '/structure/get'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['GET'])]

  @common.RequestHandler.LoginRequired
  def get(self):   # pylint: disable=g-bad-name
    """Obtain a particular structure based on a key."""

    key = self.request.get('key')
    structure = db.get(key)
    # Check that this user matches the owner of the object
    user = users.get_current_user()
    if user.user_id() != structure.user_id:
      self.abort(httplib.FORBIDDEN)
      return

    structure_dict = structure.AsDict(True)

    # reply with JSON object
    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['Content-Disposition'] = 'attachment'
    self.response.out.write(json.dumps(structure_dict))
    return


class Query(common.RequestHandler):
  ROUTE = '/structure/query'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['GET'])]

  @common.RequestHandler.LoginRequired
  def get(self):  # pylint: disable=g-bad-name
    """Get a list of structures derived from a parental_hash or parental_key."""

    user = users.get_current_user()
    parental_hash = self.request.get('parental_hash')
    parental_key = self.request.get('parental_key')

    structure_query = Structure.all()
    structure_query.ancestor(Structure.Key(structure_list_name))

    # if client wants only a particular parental hash - make it so
    if parental_hash:
      structure_query.filter('parental_hash =', parental_hash)

    # if client wants only a particular parental_key - make it so
    if parental_key:
      structure_query.filter('parental_key =', parental_key)

    # always filter by user of course
    structure_query.filter('user_id =', user.user_id())

    structures = [structure.AsDict() for structure
                  in structure_query.run()]

    # finally return a json version of our data structure
    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['Content-Disposition'] = 'attachment'
    self.response.out.write(json.dumps(structures))

class Put(common.RequestHandler):
  ROUTE = '/structure/put'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  def post(self):   # pylint: disable=g-bad-name
    """Add a structure to the database. This is called by the workers"""
    # get the task queue so we can delete the relevant task
    payload = self.request.get('output')
    payload_json = urllib.unquote_plus( payload )
    payload_data = json.loads( payload_json )

    # First make sure the taskname is in the payload data
    if not "taskname" in payload_data:
      raise common.ResultDataError

    # First delete the task that has been completed
    task.DeleteTaskByName(payload_data["taskname"])

    self.response.out.write("Success" );

    newstructure = Structure(Structure.Key(structure_list_name))

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
    



class DeleteAll(common.RequestHandler):
  ROUTE = '/structure/deleteall'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  @common.RequestHandler.LoginRequired
  def post(self):   # pylint: disable=g-bad-name
    """Delete all structures derived from a parental_hash or parental_key."""
    # grab url parameters
    parental_hash = self.request.get('parental_hash')
    parental_key = self.request.get('parental_key')
    user = users.get_current_user()
    structure_query = Structure.all()
    structure_query.ancestor(Structure.Key(structure_list_name))
    # if client wants only a particular parental hash - make it so
    if parental_hash:
      structure_query.filter('parental_hash =', parental_hash)

    # if client wants only a particular parental_key - make it so
    if parental_key:
      structure_query.filter('parental_key =', parental_key)

    # always filter by user of course
    structure_query.filter('user_id =', user.user_id())

    for structure in structure_query.run():
      structure.delete()


class Delete(common.RequestHandler):
  ROUTE = '/structure/delete'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  @common.RequestHandler.LoginRequired
  def post(self):  # pylint: disable=g-bad-name
    """Deletes a structure with a particular database key."""
    structure = db.get(self.request.get('key'))

    # Check that this user matches the owner of the object
    user = users.get_current_user()
    if user.user_id() != structure.user_id:
      self.abort(httplib.FORBIDDEN)
      return

    # or else continue to deleteing this structure
    structure.delete()


all_routes = [List.Routes(), Get.Routes(), Put.Routes(), Query.Routes(),
              DeleteAll.Routes(), Delete.Routes()]


def Routes():
  return sum(all_routes, [])

