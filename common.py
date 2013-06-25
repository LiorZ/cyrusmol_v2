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

"""Common variables, exceptions and helper functions."""

import functools
import httplib
import logging
import os

import jinja2
import webapp2

from google.appengine.api import users


class Error(Exception):
  """Base exception for cyrusmol."""


class ResultDataError(Error):
  """User has no account. Redirect to registration page."""


class UserNotRegisteredError(Error):
  """User has no account. Redirect to registration page."""


class PermissionDenied(Error):
  """Attempt to access resource that current user doesn't have access to."""


class RequestHandler(webapp2.RequestHandler):
  """Base class for all the request handlers - has common functionality."""
  _JINJA_ENV = jinja2.Environment(
      loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))

  @classmethod
  def JinjaEnv(cls):
    return cls._JINJA_ENV

  @staticmethod
  def AdminRequired(func):
    """Decorator function - checks if current user is admin."""

    @functools.wraps(func)
    def CheckAuth(self, *args, **kwargs):
      if not users.is_current_user_admin():
        user = users.get_current_user()
        logging.warning("Not Admin!: %s", user.email())
        self.abort(httplib.FORBIDDEN)
      else:
        # if user is ok, return to caller !
        return func(self, *args, **kwargs)
    return CheckAuth

  @staticmethod
  def LoginRequired(func):
    """Decorator function stub is used to check if user is registered."""

    @functools.wraps(func)
    def CheckAuth(self, *args, **kwargs):
      """Figure out if this user is registered (stub)."""
      user = users.get_current_user()

      try:  # does this user already have an account?
        # This is a stub:
        # TODO(mtyka): Add proper user registration etc..
        result = True

        # If this throws an exception or
        # sets result to false user will be redirected to registration page
        if not result:
          raise UserNotRegisteredError(
              "Unknown user: %s %s"%(str(user.user_id()), user.email()))

      except UserNotRegisteredError as e:
        # redirect to registration page !
        logging.warning("Access denied: %s", e)
        self.redirect("/register")
        return

      # if user is ok, return to caller !
      return func(self, *args, **kwargs)
    return CheckAuth

