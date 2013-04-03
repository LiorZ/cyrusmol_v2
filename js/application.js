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



// some ugly globals. TODO(mtyka) wrap these in module pattern
var current_loaded_structure;


function launch_tasks(data_pack, replication) {
    // add the parent operation as a variable if it is known.
    if (typeof current_loaded_structure !== 'undefined') {
        data_pack["parent_operation"] = current_loaded_structure.operation;
    } else {
        data_pack["parent_operation"] = ""
    }

    if (replication < 1) replication = 1;
    if (replication > 10) {
        alert("Note: This trial version limits job to a size of 10 tasks. THus only 10 tasks will be submitted.")
        replication = 10;
    }
    json_data_pack = JSON.stringify(data_pack)
    $.ajax({
        type: "POST",
        url: "/task/add?replication=" + replication,
        data: json_data_pack,
        dataType: 'json',
        success: function (msg) {
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
        type: "GET",
        url: "/task/list",
        success: function (msg) {
            var tasks = jQuery.parseJSON(msg)
            $("#tasklist").html('');
            for (tasknum in tasks) {
                var task = tasks[tasknum]
                //console.log(task)
                payload = unescape(task.payload)
                payload = payload.replace(/\\n/g, "\r");
                $("#tasklist").append($("<div> " + '<button onClick="deleteTask(\'' + task.name + '\')" >delete</button>' +
                    '<button onClick=\'$("#payload_' + task.name + '").toggle() \'>Payload</button>' + task.name + " " + task.eta + " " + task.queue_name + " " + task.size +
                    " <div style='display:none' id='payload_" + task.name + "' > Payload: <pre>" + payload + "</pre></div>" +
                    " </div>"))
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
        url: "/task/purgeall",
        success: function (msg) {
            updateTaskList();
        }
    });
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// Operations manipulation

function deleteAllOperations(key) {
    $.ajax({
        type: "POST",
        url: "/operation/deleteall",
        success: function (msg) {
            // delay the update a little bit. 
            window.setInterval("updateOperationsView()", 500);
        }
    });
}



function updateOperationsView(op_parent_key, childnode) {

    function context_menu_custom(node) {
        // The default set of all items
        var items = {
            opennode: {
                label: "Open Node",
                action: function () {
                    alert("Not yet implemented")
                }
            },
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
            deleteitem: {
                label: "Delete From Database",
                action: function () {
                    alert("Warning this will delete all structures and results associated with this job permanently")
                }
            },
        };

        return items;
    }


    $("#treeCell").jstree({
        "json_data": {
            "ajax": {
                "url": function (node) {
                    if (node == -1) {
                        return "/operation/list?parentkey="
                    } else {
                        return "/operation/list?parentkey=" + node.data("key");
                    }
                },
                "type": "get",
                "success": function (ops) {
                    data = []
                    for (opnum in ops) {
                        var op = ops[opnum]
                        info_string = ""
                        info_string_long = ""
                        if (op.info != "None") info_string = jQuery.parseJSON(op.info)["short"]
                        if (op.info != "None") info_string_long = jQuery.parseJSON(op.info)["long"]

                        info_string += " Done: " + op.count_results + "/" + op.replication + " ERR: " + op.count_errors + " CPU-mins: " + op.count_cputime
                        tooltip_content = "<b>Rosetta STDERR</b>: " + op.last_stderr + "<br><i>Right click to open context menu</i>"
                        //console.log(op)
                        node = {
                            "data": info_string,
                            "metadata": op,
                            "state": "closed",
                            "attr": {
                                "class": "show_tooltip",
                                "title": tooltip_content
                            },


                        }
                        data.push(node);
                    }
                    return data;
                }
            },
        },
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

    // clicking a node loads a graph
    $("#treeCell").bind("select_node.jstree", function (event, data) {
        // `data.rslt.obj` is the jquery extended node that was clicked
        structure_hash = data.rslt.obj.data("structure_hash");
        $("#graphbox_container").r_energy_graph(structure_hash, {
            x: "irms",
            y: "score"
        })
    })


    $("#treeCell").bind('loaded.jstree', function (e, data) {
        // invoked after jstree has loaded
        $(".show_tooltip").tooltip({
            track: true
        });
    })

}


/// Raw Structure list manipulation

function updateJobList() {
    $.ajax({
        type: "GET",
        url: "/structure/list",
        success: function (msg) {
            $("#joblist").html(msg);
        }
    });
}

function deleteAllJobs(key) {
    $.ajax({
        type: "POST",
        url: "/structure/deleteall",
        success: function (msg) {
            updateJobList();
        }
    });
}


function loadStructuresByParent(query, func_on_complete) {
    $.ajax({
        type: "GET",
        dataType: 'json',
        url: "/structure/query?" + query,
        success: func_on_complete
    });
}


function load_pdbdata_into_view( pdbdata ){
  $('#glmol01_src').val(pdbdata);
  glmol01.loadMolecule();
}

function loadFromDatastoreIntoView(key, hash) {
    $("#loadingstructure").show()

    $('#glmol01_src').val("");
    glmol01.loadMolecule();

    url = "/structure/get?"
    if( key ){
      url += "key="+key
    }else{
      url += "hash="+hash
    }

    $.ajax({
        type: "GET",
        dataType: 'json',
        url: url, 
        success: function (json_reply) {
            // Ok, check contents of json reply and, if it contains a valid structure, load it into view


            $("#loadingstructure").hide()
            current_loaded_structure = json_reply
            //console.log(json_reply)

            pdbdata = unescape(current_loaded_structure.pdbdata)
            pdbdata = pdbdata.replace(/\\n/g, "\r");

            //console.log(current_loaded_structure)

            // Load up pdb data into view
            load_pdbdata_into_view( pdbdata );

            // also load up energies into energy view
            obj = jQuery.parseJSON(current_loaded_structure.energies)
            //console.log(obj)
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
// Init

$(function () {
    updateTaskList()
    updateJobList()
    updateOperationsView()
})
