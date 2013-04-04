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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// This module implements the generic job dialog 

var JobDialogManager = (function ($) {

  function load_file_from_disk(filenamefield, textfield) {
    var file = filenamefield.get(0);
    if (file) file = file.files;
    if (!file || !window.FileReader || !file[0]) {
      alert("Yoyo! No file is selected. Or File API is not supported in your browser. Please try Firefox or Chrome.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      textfield.val(reader.result);
    };
    reader.readAsText(file[0]);
  }

  function create_file_div(user_file) {
    var thediv = $('<fieldset><legend>Virtual file</legend></fieldset>')
    thediv.append("<input class='width:400px' size=60 value='" + user_file.filename + "' > ")

    // the textfield is where the file contents go into.
    var textfield = $('<textarea></textarea>', {
      'id': 'file_textfield'
    }).css("width", "100%")
    if (user_file.default_from_url === undefined) {
      textfield.val(user_file.content)
    } else {
      $.get(user_file.default_from_url, function (ret) {
        textfield.val(ret)
      });
    }

    var filename_field = $('<input></input>', {
      'id': 'file_filenamefield',
      'class': 'filechooser',
      'type': 'file',
      'size': '1'
    }).hide()
    filename_field.change(function () {
      load_file_from_disk(filename_field, textfield)
    })

    var loadfile_button = $('<button>Upload...</button>').click(function () {
      $(this).parent().find('#file_filenamefield').click()
    })

    thediv.append(filename_field)
    thediv.append(loadfile_button)
      .append($('<button>X</button>').click(function () {
      $(this).parent().remove()
    }))
      .append(textfield)

    return thediv;
  }



  function create_jobname_section(default_name) {
    fieldset = $('<fieldset><legend>Job Name</legend></fieldset>')
      .append($('<input></input>', {
      'id': 'jobname',
      'value': default_name
    }))
    jobname_section = $("<div></div>").append(fieldset)
    jobname_section.append($("<p>"));
    return jobname_section;
  }

  function create_stderr_section(stderr) {
    if (stderr === undefined) return; // return nothing if stderr field was not set 
    fieldset = $('<fieldset><legend>Last STDERR</legend></fieldset>')
      .append($('<pre></pre>', {
      'id': 'stderr'
    }).html(stderr))
    stderr_section = $("<div></div>").append(fieldset)
    stderr_section.append($("<p>"));
    return stderr_section;
  }


  // creates an input file section
  function create_file_section(user_files) {
    // --------- Inout File section -----------------------------------------------------------------

    // create and set up the input data file section
    fieldset = $('<fieldset><legend>Additional Input Data</legend></fieldset>')
    // go through all the requested filenames and make a section in the form for each
    for (i_user_files in user_files) {
      (function () {
        fieldset.append(create_file_div(user_files[i_user_files]))
      })();
    }

    fieldset.append($('<button>Add file</button>').click(function () {
      $(this).before(create_file_div({
        filename: "filename",
        default_from_url: false
      }))
    }))
    file_section = $("<div></div>").append(fieldset)
    file_section.append($("<p>"));
    return file_section;
  }

  function create_options_fieldpair(id, flag, value) {
    return $($('<div></div>', {
      'id': id,
      'class': 'options_div'
    }))
      .append($('<input></input>', {
      'id': 'userflag',
      'value': flag
    }))
      .append($('<input></input>', {
      'id': 'flagoption',
      'value': value
    }))
      .append($('<button>X</button>').click(function () {
      $(this).parent().remove()
    }))
  }


  // creates a flags section
  function create_parameters_section(parameters) {
    if (parameters === undefined) return; // return nothing if no paramters section was defined
    fieldset = $('<fieldset id="parameter_select" ><legend>Additional flags</legend></fieldset>')
    for (parameter in parameters) {
      fieldset.append($('<div></div>', {
        'id': parameter,
        'class': 'parameters_div'
      })
        .append($('<span></span>').html(parameter + " = &nbsp; "))
        .append($('<input></input>', {
        'id': 'parameter',
        'value': parameters[parameter]["value"]
      })))
    }
    return $("<div></div>").append(fieldset).append($("<p>"));
  }

  // creates a flags section
  function create_flags_section(user_flags, flags_file, display_all) {

    fieldset = $('<fieldset id="parameter_select" ><legend>Additional flags</legend></fieldset>')
    parameter_select = $('<select id="select_flags" > </select>')
    parameter_select.append($('<option value="-"> -- add flag -- </option>'));
    parameter_select.change(function (fevent) {
      // get "value" of selected option
      selected_option = $(this).find(":selected").attr("value");
      if (selected_option == "custom") {
        option_div = create_options_fieldpair('custom_flagoption_div', 'flag here', 'value here')
      } else {
        option_div = create_options_fieldpair('custom_flagoption_div',
        $(this).find(":selected").attr('flag'),
        $(this).find(":selected").attr('default_value'))
      }
      $(this).parent().find("select#select_flags").after(option_div)

      // now revert the selected element to the top one since the selector is to be non-permanent - its actually more of a pulldown button collection
      $(this).val("-").attr('selected', true);
    })

    fieldset.append(parameter_select)
    option = $('<option value="custom" >[custom]</option>')
    parameter_select.append(option);
    var counter = 0;
    for (user_flag in user_flags) {
      option = $('<option></option>', {
        'value': 'flagoption' + counter,
        'flag': user_flag,
        'default_value': user_flags[user_flag]["value"]
      })
      option.html(user_flag + '  [' + user_flags[user_flag]["value"].substring(0, 40) + ']')
      parameter_select.append(option);
      counter += 1;
    }

    if (display_all) {
      for (user_flag in user_flags) {
        option_div = create_options_fieldpair('custom_flagoption_div', user_flag, user_flags[user_flag]["value"])
        console.log(user_flag, user_flags[user_flag]["value"])
        fieldset.append(option_div)
      }
    }

    var flags_file_field = $('<textarea></textarea>', {
      'id': 'flags_file_field'
    }).css("width", "100%")
    if (flags_file !== undefined) {
      flags_file_field.val(flags_file)
    }

    var flags_file_field_frame = $('<fieldset id="flags_file_field_frame" ><legend>AND/OR Paste flags file:</legend></fieldset>')


    fieldset.append($("<p>&nbsp</p>").append(flags_file_field_frame.append(flags_file_field)))

    return $("<div></div>").append(fieldset).append($("<p>"));
  }

  function create_xml_script_section(xmlscript) {
    var thediv = $("<div></div>", {
      "id": "xmlscript_div"
    })
    if (xmlscript === undefined) return thediv
    var fieldset = $('<fieldset id="default_xml_script_select" ><legend>Rosetta XML Script</legend></fieldset>')
    var textarea = $('<textarea></textarea>', {
      'id': 'xmlscript',
      'cols': '110',
      'rows': '20'
    })
    if (xmlscript.content !== undefined) {
      textarea.val(xmlscript.content)
    }
    var default_xml_script_select = $('<select id="select_default_scripts" > </select>')
    default_xml_script_select.change(function (fevent) {
      // get "value" of selected option
      selected_option = $(this).find(":selected").attr("value");
      if (selected_option != "--") {
        $.get(selected_option, function (ret) {
          textarea.val(ret)
        }, "html");
      }
    })
    default_xml_script_select.append($('<option></option>', {
      'value': '--'
    }).html("Load template script"))
    for (i_choice in xmlscript.default_choices) {
      var choice = xmlscript.default_choices[i_choice]
      default_xml_script_select.append($('<option></option>', {
        'value': choice
      }).html(choice))
    }

    var filename_field = $('<input></input>', {
      'id': 'file_filenamefield',
      'class': 'filechooser',
      'type': 'file',
      'size': '1'
    }).hide()
    filename_field.change(function () {
      load_file_from_disk(filename_field, textarea)
    })
    var loadfile_button = $('<button>Upload...</button>').click(function () {
      $(this).parent().find('#file_filenamefield').click()
    })

    fieldset.append(filename_field)
    fieldset.append(loadfile_button)
    fieldset.append($("<i> &nbsp; or &nbsp; </i>"))
    fieldset.append(default_xml_script_select).append($("<p>"))
    fieldset.append(textarea)
    thediv.append(fieldset)
    return thediv
  }


  function submit_dialog_job(dialog, data, destination) {
    // grab all the user-set options, overwriting the default ones

    dialog.find("#custom_flagoption_div").each(

    function () {
      console.log($(this).find("input#flagoption").attr("value"))
      data.user_flags[$(this).find("input#userflag").attr("value")] = {
        "value": $(this).find("input#flagoption").attr("value"),
        "help": ""
      }
    })
    data.jobname = dialog.parent().find('#jobname').val()

    replication = dialog.parent().find('#nstruct').val()


    data_pack = data
    data_pack["flags_file"] = dialog.parent().find('#flags_file_field').val()
    data_pack["operation_info"] = {
      "short": data.jobname,
      "long": data.jobname
    }
    data_pack["pdbdata"] = $('#glmol01_src').val()

    if (data.xmlscript !== undefined) {
      data_pack["xmlscript"]["content"] = dialog.find("#xmlscript").val()
    }

    console.log(dialog)
    console.log(data_pack)

    if( destination == "backend" || destination === undefined ){
      ServerRequests.launch_tasks(data_pack, replication)
    } else if( destination == "nacls" ){
      //console.log( JSON.stringify( data_pack ) )
      common.naclModule.postMessage(  JSON.stringify( data_pack ) )
    
    
    } else {
      alert("CODERROR");
    }

    dialog.remove();
  }

  function open_job_dialog_from_server_json(url) {
    $.get(url, function (ret) {
      open_job_dialog(ret)
    }, "json");
  }

  function open_job_dialog(data, read_only, pdbdata) {
    dialog = $('<div></div>', {
      'id': "jobdialog",
      name: data.name
    })
    dialog.append(create_jobname_section(data.jobname))
    dialog.append(create_stderr_section(data.last_stderr))
    dialog.append(create_parameters_section(data.parameters))
    dialog.append(create_xml_script_section(data.xmlscript))
    dialog.append(create_file_section(data.user_files))
    dialog.append(create_flags_section(data.user_flags, data.flags_file, read_only))
    $("body").append(dialog)
    dialog.dialog({
      height: 700,
      width: 700,
      buttons: {
        "Submit job": function () {
          submit_dialog_job(dialog, data, "backend" )
          $(this).dialog().dialog("close");
        },
        "Submit job NACLS": function () {
          submit_dialog_job(dialog, data, "nacls" )
          $(this).dialog().dialog("close");
        },
        "Cancel": function () {
          $(this).dialog().dialog("close");
        }
      }
    })
    nstruct_div = $("<span>#jobs: (nstruct): </span>")
    nstruct = $("<input>", {
      "id": "nstruct",
      "value": "1",
      "size": "4"
    })
    nstruct_div.append(nstruct)
    nstruct_div.append($("<span>&nbsp;&nbsp;&nbsp;</span>"))
    dialog.parent().find(".ui-dialog-buttonset").prepend(nstruct_div)

    if (read_only) {
      dialog.parent().find("select").remove()
      dialog.parent().find("button").remove()
      dialog.parent().find("textarea").attr("readonly", "true")
      dialog.parent().find("input").attr("readonly", "true")
    }


  }


  // init window elements
  $(function () {


    $("button#prep_score").click(function () {
      open_job_dialog_from_server_json("/data/jobdefs/score.json")
    })
    $("button#prep_relax").click(function () {
      open_job_dialog_from_server_json("/data/jobdefs/relax.json")
    })
    $("button#prep_loophash").click(function () {
      open_job_dialog_from_server_json("/data/jobdefs/loophash.json")
    })
    $("button#prep_enzdes").click(function () {
      open_job_dialog_from_server_json("/data/jobdefs/enzdes1.json")
    })
    $("button#prep_xmlscript").click(function () {
      open_job_dialog_from_server_json("/data/jobdefs/xmlscript_generic.json")
    })
  });
   
  // public module functions:

  var my = {}

  // open a job dialog window using the job descriptor "val"
  my.open_job_dialog = function (val, readonly) {
    open_job_dialog(val, readonly)
  }

  return my;
}(jQuery));



