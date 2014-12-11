// Written by mtyka@google.com (Mike Tyka)
//
// Copyright 2012-2013 Google Inc.
//
// Dual license of MIT license or LGPL3 (the "Licenses")
// MIT license: http://opensource.org/licenses/MIT
// LGPL3: www.gnu.org/licences/lgpl.txt
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the Licenses is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the Licenses for the specific language governing permissions and
// limitations under the Licenses.
//


var ServerRequests = (function($) {
  var my = {}


  my.current_loaded_structure = {};


  my.launch_tasks = function(data_pack, replication) {
      // add the parent operation as a variable if it is known.
      if ( my.current_loaded_structure ) {
          data_pack["parent_operation"] = ""
      } else {
          data_pack["parent_operation"] = my.current_loaded_structure.operation;
      }

      // At least 1 replication has to be requested.
      if (replication < 1) replication = 1;
      // limit task replication to 10 for now. This is actually enforced on the server, but it's polite to
      // alert the user.
      replication_limit = 100
      if (replication > replication_limit) {
          alert("Note: This trial version limits job to a size of " + replication_limit + " tasks. Thus only " + replication_limit + " tasks will be submitted.")
          replication = replication_limit;
      }
      data_pack["replication"] = replication

      // Turn data_pack into json string and POST it to the server
      $.ajax({
          type: "POST",
          url: "/operation/add",
          data: JSON.stringify(data_pack),
          dataType: 'json',
          success: function (msg) {
              // If we succeeded update the two debug tabs.
              updateTaskList()
              updateOperationsView()
          },
          contentType: "application/json; charset=utf-8"
      });

  }


  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /// Tasklist manipulation

  function updateTaskList() {
      $.ajax({
          type: "POST",
          url: "/task/lease?lease_time=0&max_tasks=100",
          success: function (tasks) {
              $("#tasklist").empty()
              for (tasknum in tasks) {
                  // put this in a closure so each delete/toggle function will refer to the correct element
                  (function(){
                    var task = tasks[tasknum]
                    var payload = unescape(task.payload)
                    payload = payload.replace(/\\n/g, "\r");
                    var taskdiv = $("<div></div>")
                    var delete_button = $("<button>Delete</button>").click( function(){ var mytaskname = task.name; deleteTask(mytaskname); } )
                    var payload_button = $("<button>Show/Hide Payload</button>").click( function(){ $(this).parent().find("#payload").toggle() } )
                    var taskinfo = $("<span></span>").html( " " + task.name + " " + task.queue_name )
                    var payload_div = $("<div></div>", { "style":"display:none", id:"payload" } ).html( "<pre>" + payload + "</pre>" )
                    taskdiv.append(delete_button).append(payload_button).append(taskinfo).append(payload_div)
                    $("#tasklist").append(taskdiv)
                  })()
              }
          }
      });
  }

  function deleteTask(taskname) {
      $.ajax({
          type: "POST",
          url: "/task/delete?taskname=" + taskname,
          success: function (msg) {
              updateTaskList();
          }
      });
  }

  function purgeQueue() {
      $.ajax({
          type: "POST",
          url: "/task/deleteall",
          success: function (msg) {
              updateTaskList();
          }
      });
  }


  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /// Operations manipulation

  // send an AJAX request to delete all the operations currently on the server.
  function deleteAllOperations(key) {
      $.ajax({
          type: "POST",
          url: "/operation/deleteall",
          success: function (msg) {
              // On success empty the tree container to update the client view of the data.
              $("#treeCell").empty();
          }
      });
  }


  // fills the Operations tree view with data from the server (by issueing an ajax request)
  function updateOperationsView(op_parent_key, childnode) {

      function context_menu_custom(node) {
          // The default set of all items
          var items = {
              load_structure: {
                  label: "Load Input Structure into 3D view",
                  action: function () {
                     var key = node.data("structure_key")
                     loadFromDatastoreIntoView(key)
                  }
              },
              inspect: {
                  label: "Inspect Job Details",
                  action: function () {
                      var job_data = jQuery.parseJSON(node.data("job_data"))
                      job_data["last_stderr"] = node.data("last_stderr")
                      JobDialogManager.open_job_dialog(job_data,true)
                  }
              },
              submitmore: {
                  label: "Submit more jobs",
                  action: function () {
                      var job_data = jQuery.parseJSON(node.data("job_data"))
                      JobDialogManager.open_job_dialog(job_data,false)
                  }
              },
              download_pdbs: {
            	  label:"Download output PDBs",
            	  action: function() {
            		  var key = node.data("structure_key");
            		  window.location = "/structure/get_pdbs?parental_key=" + key;
            	  }
              }
          };

          return items;
      }

      tree_ajax_success = function (ops) {
        // ops is the data the server returns when asked for a list of nodes. Each is basically a json object
        // with information about the respective operation
        var new_node_list = []
        for (opnum in ops) {
          var op = ops[opnum]
          var info_string = ""
          if (op.info != "None") info_string = jQuery.parseJSON(op.info)["short"]
          info_string += " Done: " + op.count_results + "/" + op.replication + " ERR: " + op.count_errors + " CPU-mins: " + op.count_cputime

          // define the node for jstree
          var node = {
            "data": info_string,
            "metadata": op,
            "state": "closed",
          }
          new_node_list.push(node);
        }
        return new_node_list;
      }

      // invoke jstree and turn the prepped div #treeCell into a tree as defined here
      $("#treeCell").jstree({
          "json_data": {
              "ajax": {
                  "url": function (node) {
                      // jstree will set node to -1 when it's the root node. In that case set the parentkey to emptystring.
                      // otherwise specify the key of the parent node (in which case the server will only return a list of its children)
                      if (node == -1) {
                          return "/operation/list?parentkey="
                      } else {
                          return "/operation/list?parentkey=" + node.data("key");
                      }
                  },
                  "type": "get",
                  "success": tree_ajax_success
              },
          },

          // this adds a right-click context menu to the tree view to allow various
          // user command to be executed on this node ( actual menu defined above in context_menu_custom )
          "contextmenu": {
              "items": context_menu_custom,
              "show_at_node": false
          },
          "core": {
              "html_titles": true,
              "load_open": true
          },
          "plugins": ["themes", "json_data", "ui", "cookies", "crrm", "sort", "contextmenu"]
      });

      // clicking a node loads a graph with the structure data of this node.
      $("#treeCell").bind("select_node.jstree", function (event, data) {
          // `data.rslt.obj` is the jquery extended node that was clicked

          // extract the structure hash which identifies the parent structure and call the graphbox_container's plotting function to
          // get all the structures with this parental hash and plot the energies.
          structure_hash = data.rslt.obj.data("structure_hash");

          // call the custom jquery function r_energy_graph (defined in graphing.js) to create the graph inside of #graphbox_container
          $("#graphbox_container").r_energy_graph(structure_hash, {
              x: "irms",  // by default plot irms vs score
              y: "score"
          })
      })
  }



  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /// Raw Structure list manipulation. THe raw structure list is a little tab on the bottom of the screen that helps with debugging mainly.

  function updateStructureList() {
      $.ajax({
          type: "GET",
          url: "/structure/list",
          success: function (structures) {
            // clear the current div
            $("#joblist").empty();
            for(var i in structures){
               var structure = structures[i]

               sdiv = $("<div></div>", { "id":"id" + structure.id } )
               idiv = $("<div></div>", { "id":"id" + structure.id, "class": "structure"} )
               idiv.append("<br>")
               idiv.append( $("<a></a>", { "href":"/structure/get?key=" + structure.key } ).html( "(Raw View)" ) )

               idiv.append( $( "<div></div>" ).html( "cpuseconds   : " + structure.cpuseconds    ))
               idiv.append( $( "<div></div>" ).html( "created_time : " + structure.created_time  ))
               idiv.append( $( "<div></div>" ).html( "energies     : " + structure.energies      ))
               idiv.append( $( "<div></div>" ).html( "hash_sha1    : " + structure.hash_sha1     ))
               idiv.append( $( "<div></div>" ).html( "key          : " + structure.key           ))
               idiv.append( $( "<div></div>" ).html( "operation    : " + structure.operation     ))
               idiv.append( $( "<div></div>" ).html( "parental_hash: " + structure.parental_hash ))
               idiv.append( $( "<div></div>" ).html( "parental_key : " + structure.parental_key  ))
               idiv.append( $( "<div></div>" ).html( "queuename    : " + structure.queuename     ))
               idiv.append( $( "<div></div>" ).html( "stderr       : " + structure.stderr        ))
               idiv.append( $( "<div></div>" ).html( "taskname     : " + structure.taskname      ))
               idiv.append( $( "<div></div>" ).html( "user_id      : " + structure.user_id       ))
               idiv.append( $( "<div></div>" ).html( "workerinfo   : " + structure.workerinfo    ))
               sdiv.append(idiv)
               $("#joblist").append( sdiv )
             }
          }
      });
  }

  function deleteAllStructures(key) {
      $.ajax({
          type: "POST",
          url: "/structure/deleteall",
          success: function (msg) {
              updateStructureList();
          }
      });
  }


  // public helper function which issues an AJAX request to get a JSON list of structures based on a query string
  my.loadStructuresByParent = function(parent_hash, func_on_complete) {
      $.ajax({
          type: "GET",
          dataType: 'json',
          url: "/structure/query?parental_hash=" + parent_hash,
          success: func_on_complete
      });
  }


  my.loadFromDatastoreIntoView = function(key, hash) {
      $("#loadingstructure").show()

      $('#glmol01_src').val("");
      glmol01.loadMolecule();

      url = "/structure/get?"
      if( key ){
        url += "key="+key
      }else if ( hash ){
        url += "hash="+hash
      } else {
        console.log("Error: must specify either key or hash");
      }

      $.ajax({
          type: "GET",
          dataType: 'json',
          url: url,
          success: function (json_reply) {
              // Ok, check contents of json reply and, if it contains a valid structure, load it into view


              $("#loadingstructure").hide()
              my.current_loaded_structure = json_reply
              //console.log(json_reply)

              pdbdata = unescape(my.current_loaded_structure.pdbdata)
              pdbdata = pdbdata.replace(/\\n/g, "\r");

              //console.log(my.current_loaded_structure)

              // Load up pdb data into view
              load_pdbdata_into_view( pdbdata );

              // also load up energies into energy view
              obj = jQuery.parseJSON(my.current_loaded_structure.energies)

              // make a quick table displaying the data
              enehtml = "<table>"
              keylist = []
              for (var key in obj) {
                  keylist.push(key)
              }
              for (k in keylist.sort()) {
                  key = keylist[k]
                  enehtml += "<tr><td>" + key + "</td><td>" + Math.round((obj[key]) * 100.0) / 100.0; + "</td></tr>"
              }
              $("#energybox").html(enehtml)

          }
      });

  }




  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Init - set up user interface and button events
  $(function(){
    // load all the various views using AJAX requests
    updateTaskList()
    updateStructureList()
    updateOperationsView()


    // register the button events on the page
    $("button#updateStructureList").click(function(){updateStructureList()})
    $("button#deleteAllStructures").click(function(){deleteAllStructures()})
    $("button#updateOperationsView").click(function(){updateOperationsView('')})
    $("button#deleteAllOperations").click(function(){deleteAllOperations()})
    $("button#updateTaskList").click(function(){updateTaskList()})
    $("button#purgeQueue").click(function(){purgeQueue()})
  })

  // return object with public member functions/variables
  return my;
})(jQuery)
