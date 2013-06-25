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

"""Defines functions and handlers that queue and lease individual tasks.
"""

import hashlib
import json
import webapp2
import logging

from google.appengine.api import taskqueue
from google.appengine.api import users

import common

SLOW_TASKS_QUEUE_NAME = 'slow-tasks'
TASK_NAME_SEPARATOR = '_'


class Lease(webapp2.RequestHandler):
  ROUTE = '/task/lease'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  def post(self):  # pylint:disable=g-bad-name
    """Takes one or more tasks off the top of the queue and leases them."""
    queue = taskqueue.Queue(SLOW_TASKS_QUEUE_NAME)

    lease_time = int(self.request.get('lease_time') or 0)
    max_tasks = int(self.request.get('max_tasks') or 1)

    tasks = queue.lease_tasks(lease_time, max_tasks)

    tlist = [{
        'name': str(t.name),
        'payload': str(t.payload),
        'queue_name': str(t.queue_name),
        } for t in tasks]

     
    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['Content-Disposition'] = 'attachment'
    self.response.out.write(json.dumps(tlist))


def CreateTaskName(userid, sha1hash, replication):
  """Defines and creates a taskname from its three components."""
  return TASK_NAME_SEPARATOR.join([userid, sha1hash, str(replication)])


def QueueTasks(taskdata, replication=1):
  """Queues up tasks with taskdata as payload, 'replication' times."""
  user = users.get_current_user()
  taskdata_hash = hashlib.sha1(str(taskdata)).hexdigest()
  tasks = [taskqueue.Task(payload=json.dumps(taskdata),
                          method='PULL',
                          name=CreateTaskName(user.user_id(),
                                              taskdata_hash,
                                              str(i)))
           for i in xrange(replication)]
  queue = taskqueue.Queue(SLOW_TASKS_QUEUE_NAME)
  queue.add(tasks)


def DeleteTaskByName(taskname, queuename=SLOW_TASKS_QUEUE_NAME):
  """Helper function that deletes a task given  taskname."""

  queue = taskqueue.Queue(queuename)
  task = taskqueue.Task(name=taskname)
  queue.delete_tasks(task)


class Delete(webapp2.RequestHandler):
  ROUTE = '/task/delete'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  @common.RequestHandler.LoginRequired
  def post(self):  # pylint:disable=g-bad-name
    """Delete a particular task."""
    logging.info( "DELETEING" )
    taskname = self.request.get('taskname')
  
    user_id = users.get_current_user().user_id()
    if not taskname.startswith(user_id + TASK_NAME_SEPARATOR):
      raise common.PermissionDenied
    
    DeleteTaskByName(taskname)


class DeleteAll(webapp2.RequestHandler):
  ROUTE = '/task/deleteall'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  #@common.RequestHandler.AdminRequired
  @common.RequestHandler.LoginRequired
  def post(self):  # pylint:disable=g-bad-name
    """Deletes all the tasks."""
    queue = taskqueue.Queue(SLOW_TASKS_QUEUE_NAME)
    queue.purge()


all_routes = [Lease.Routes(), Delete.Routes(), DeleteAll.Routes()]


def Routes():
  return sum(all_routes, [])

