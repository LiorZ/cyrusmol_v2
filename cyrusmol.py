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

from google.appengine.api import users

import common
import operation
import structure
import task


class MainPageHandler(common.RequestHandler):
  ROUTE = '/'

  @classmethod
  def Routes(cls):
    return [webapp2.Route(cls.ROUTE, cls, methods=['GET'])]

  @common.RequestHandler.LoginRequired
  def get(self):  # pylint:disable=g-bad-name
    """Delivers main page content (index.html)"""
    user = users.get_current_user()
    # grab template file and a few basic values and send out response
    template = self.JinjaEnv().get_template('index.html')
    template_values = [("logout_url",users.create_logout_url("/")), 
                       ("user",user.email()), 
                       ("user_id",user.user_id())]
    self.response.out.write(template.render(template_values))


# Main WSGI app as specified in app.yaml
app = webapp2.WSGIApplication(sum([MainPageHandler.Routes(),
                                   operation.Routes(),
                                   task.Routes(),
                                   structure.Routes(),
                                  ],
                                  []), debug=True)

