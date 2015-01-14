#!/usr/bin/env python
#
# Written by liorz1984@gmail.com (Lior Zimmerman)
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

"""Defines a serielization scheme for diagrams.

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

import StringIO
diagram_list_name = 'db_diagrams'


class Diagram(db.Model):
  """
    This is just a class that stores a json of diagrams per user.
  """
  user_id = db.StringProperty()
  created_time = db.DateTimeProperty(auto_now_add=True)
  json = db.BlobProperty()
  is_public = db.BooleanProperty()

  @classmethod
  def Key(cls, diagram_name):
    """Constructs a Datastore key for a Structure entity with structure_name."""
    return db.Key.from_path('Diagram', diagram_name)

  def AsDict(self, include_pdbdata=False):
    """Returns data in dictionary form."""
    dform = {
        'key': str(self.key()),
        'created_time': str(self.created_time),
        'json': json.loads(self.json),
        'is_public':str(self.is_public),
        }
    return dform


class List(common.RequestHandler):
  ROUTE = r'/diagrams'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['GET'])]

  @common.RequestHandler.LoginRequired
  def get(self):   # pylint: disable=g-bad-name
    """Obtain a list of structures."""
    user = users.get_current_user()

    diagram_query = Diagram.all()
    diagram_query.filter('user_id =', user.user_id())
    diagram_query.order('created_time')
    diagram_arr = diagram_query.run()
    diagram_jsons = [d.AsDict()['json'] for d
                  in diagram_arr]


    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['Content-Disposition'] = 'attachment'
    self.response.out.write(json.dumps(diagram_jsons))

class New(common.RequestHandler):
  ROUTE = r'/diagrams'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['POST'])]

  def post(self):   # pylint: disable=g-bad-name
    """Add a structure to the database. This is called by the workers"""
    # get the task queue so we can delete the relevant task
    user = users.get_current_user()

    json_data = json.loads(str(self.request.body))

    key = Diagram.Key(diagram_list_name)
    new_diagram = Diagram(key)

    new_diagram.is_public = False
    new_diagram.user_id = user.user_id()
    new_diagram.put()

    json_data['id'] = str(new_diagram.key())
    new_diagram.json = json.dumps(json_data)
    new_diagram.put()

    self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
    self.response.headers['Content-Disposition'] = 'attachment'
    self.response.out.write(json.dumps(json_data))

class Update(common.RequestHandler):
    ROUTE = r"/diagrams/<:([^/]+)?>"

    @classmethod
    def Routes(cls):
        return [webapp2.Route(cls.ROUTE, cls, methods=['PUT'])]

    @common.RequestHandler.LoginRequired
    def put(self,key):   # pylint: disable=g-bad-name
        diagram = Common.valid_diagram_by_key(key)
        if diagram == None:
            self.abort(httplib.FORBIDDEN)
            return
        json_data = self.request.body

        diagram.json = json_data
        diagram.put()
        self.response.set_status(200)

class Delete(common.RequestHandler):
    ROUTE = r"/diagrams/<:([^/]+)?>"

    @classmethod
    def Routes(cls):
        return [webapp2.Route(cls.ROUTE, cls, methods=['DELETE'])]

    @common.RequestHandler.LoginRequired
    def delete(self,key):   # pylint: disable=g-bad-name
        diagram = Common.valid_diagram_by_key(key)
        if ( diagram == None ):
            self.abort(httplib.FORBIDDEN)
            return
        diagram.delete()

        self.response.set_status(200)

class Common(object):

    @staticmethod
    def valid_diagram_by_key(key):
        user = users.get_current_user()
        user_id = user.user_id()

        if key == None:
            return None

        diagram = Diagram.get(key)
        print diagram

        if diagram == None or diagram.user_id != user_id:
            return None

        return diagram

all_routes = [List.Routes(), New.Routes(), Update.Routes(), Delete.Routes()]


def Routes():
  return sum(all_routes, [])
