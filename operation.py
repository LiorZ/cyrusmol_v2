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

"""Defines the 'Operation' data model.

An operation is defined as any block of replicated jobs sharing the same basic
execution data. It has a starting structure and often has a parent operation
and a json structure containing the specific job information (job_data)
"""

import hashlib
import httplib
import json
import webapp2
import logging 

from google.appengine.api import users
from google.appengine.ext import db

import common
import structure
import task

operation_list_name = 'db_operations'
REPLICATION_LIMIT = 100


class Operation(db.Model):
  """Models an operation.

     user_id: user_id to keep track of the owner
     created_time: keep track of creation time
     parentkey: dbkey of parent operation that was last applied to the
                starting structure of this operation
     structure_key: dbkey of starting structure for this operation
     structure_hash: SHA1 hash of the pdb data. This is for querying,
                tracking and comparison
     replication: how many jobs to be executed
     job_data: JSON structure of input paramenters
     info: Human readable description of operation (ignored by computers)
     count_results: how many jobs have returned
     count_errors: how many jobs failed
     count_cputime: how much CPU time in seconds has accumulated
     last_stderr: last error that came in
  """

  user_id = db.StringProperty()
  created_time = db.DateTimeProperty(auto_now_add=True)
  parentkey = db.StringProperty()
  structure_key = db.StringProperty()
  structure_hash = db.StringProperty()
  replication = db.IntegerProperty()
  job_data = db.BlobProperty()
  info = db.StringProperty()
  count_results = db.IntegerProperty()
  count_errors = db.IntegerProperty()
  count_cputime = db.IntegerProperty()
  last_stderr = db.TextProperty()

  @classmethod
  def Key(cls, operation_name):
    """Constructs a Datastore key for a Operation entity with operation_name."""
    return db.Key.from_path('Operation', operation_name)


class Add(webapp2.RequestHandler):
  ROUTE = '/operation/add'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  @common.RequestHandler.LoginRequired
  def post(self):  # pylint:disable=g-bad-name
    """Deal with request to queue up a new operation."""

    user = users.get_current_user()
    job_data = json.loads(self.request.body)
   
    # clean up request data
    if 'replication' not in job_data: job_data['replication'] = 1 
    job_data['replication'] = int( job_data['replication'] )
    if job_data['replication'] > REPLICATION_LIMIT:
      job_data['replication'] = REPLICATION_LIMIT
    elif job_data['replication'] < 1:
      job_data['replication'] = 1

    pdb_hash = hashlib.sha1(str(job_data['pdbdata'])).hexdigest()

    # set up a new operation data block and set some reasonable initial values
    new_operation = Operation(
        parent=Operation.Key(operation_list_name))
    new_operation.user_id = user.user_id()
    new_operation.structure_key = ''
    new_operation.structure_hash = pdb_hash
    new_operation.replication = job_data['replication']
    new_operation.parentkey = job_data['parent_operation']
    new_operation.job_data = json.dumps(job_data)
    new_operation.info = json.dumps(job_data['operation_info'],
                                    separators=(',', ':'))
    new_operation.count_results = 0
    new_operation.count_errors = 0
    new_operation.count_cputime = 0
    new_operation.last_stderr = ''
    new_operation.put()

    # Also create a data entry for the structure itself
    newstructure = structure.Structure(
        parent=structure.Structure.Key(structure.structure_list_name))
    newstructure.user_id = user.user_id()
    newstructure.workerinfo = ''
    newstructure.pdbdata = str(job_data['pdbdata'])
    newstructure.hash_sha1 = pdb_hash
    newstructure.operation = str(new_operation.key())
    newstructure.put()

    new_operation.structure_key = str(newstructure.key())
    new_operation.put()

    taskdata = {
        'key': str(newstructure.key()),
        'hash_sha1': newstructure.hash_sha1,
        'user_id': user.user_id(),
        'operation': newstructure.operation,
        'job_data': json.dumps(job_data)
        }

    task.QueueTasks(taskdata, job_data['replication'])


class List(common.RequestHandler):
  ROUTE = '/operation/list'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['GET'])]

  @common.RequestHandler.LoginRequired
  def get(self):  # pylint:disable=g-bad-name
    """Obtains a JSON list of all the operations in the database."""
    user = users.get_current_user()
    parentkey = self.request.get('parentkey')
    operation_data = []

    try:
      operations_query = Operation.all()
      if parentkey: 
        operations_query.filter('parentkey =', parentkey)
      operations_query.filter('user_id =', user.user_id())

      operation_data = [{
          'key': str(operation.key()),
          'parentkey': str(operation.parentkey),
          'structure_key': str(operation.structure_key),
          'structure_hash': str(operation.structure_hash),
          'replication': operation.replication,
          'count_results': operation.count_results,
          'count_errors': operation.count_errors,
          'count_cputime': operation.count_cputime,
          'last_stderr': str(operation.last_stderr),
          'job_data': str(operation.job_data),
          'info': operation.info,
          } for operation in operations_query.run()]
      self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
      self.response.headers['Content-Disposition'] = 'attachment'
      self.response.out.write(json.dumps(operation_data))
    except BaseException:
      return common.ReturnServerError(self)


class DeleteAll(common.RequestHandler):
  ROUTE = '/operation/deleteall'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  @common.RequestHandler.LoginRequired
  def post(self):  # pylint:disable=g-bad-name
    """Delete all the operations entries in the database (of this user)."""
    user = users.get_current_user()
    operations_query = Operation.all().ancestor(
        Operation.Key(operation_list_name))
    operations_query.filter('user_id =', user.user_id())
    for op in operations_query.run():
      op.delete()


class Delete(common.RequestHandler):
  ROUTE = '/operation/delete'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  @common.RequestHandler.LoginRequired
  def post(self):  # pylint:disable=g-bad-name
    """Delete an operations with a particular key."""
    op = db.get(self.request.get('key'))
    user = users.get_current_user()
    if user.user_id() != op.user_id:
      self.abort(httplib.FORBIDDEN)
      return
    op.delete()


all_routes = [Add.Routes(), List.Routes(),
              Delete.Routes(), DeleteAll.Routes()]


def Routes():
  return sum(all_routes, [])

