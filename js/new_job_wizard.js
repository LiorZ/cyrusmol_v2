var NewJobWizard = (function($) {

  //FORM PROCESSING:

  var FormJobProcessor = {

    'backend_loophash': function(data){
      data.parameters = {
        loopstart:$('#loopstart').val(),
        loopend: $('#loopend').val()
      };

    },

    'backend_rscripts' : function(data) {

      data.xmlscript = $('#rscripts_text').val();
    },

    'backend_diagrams': function(data){
      var id = $('#wizard_rosetta_diagrams a.active').attr('data-id');
      var diagram = RosettaDiagrams.DiagramsCollection.find(function(d) {
        return d.get('id') == id;
      });

      var xml = RosettaDiagrams.get_rosetta_scripts(diagram);
      data.xmlscript["content"] = xml;
    }

  };
  //First Card:
  ///////////////////////////////////////////////////////////////////////////////////////////


  var loadFile = function(filename, onload_callback) {
    var file = filename
    if (file) file = file.files;
    if (!file || !window.FileReader || !file[0]) {
      alert("No file is selected. Or File API is not supported in your browser. Please try Firefox or Chrome.");
      return;
    }
    //$('#loading').show();
    var reader = new FileReader();
    reader.onload = function() {
        onload_callback(reader.result)
    }
    reader.readAsText(file[0]);
  }

  function load_job_data(url, success_func) {
    $.get(url, success_func, "json");
  }

  launch_tasks = function(data_pack, replication, callbacks) {
    // // add the parent operation as a variable if it is known.
    // if ( my.current_loaded_structure ) {
        data_pack["parent_operation"] = ""
    // } else {
    //     data_pack["parent_operation"] = my.current_loaded_structure.operation;
    // }

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
    $.post("/operation/add",JSON.stringify(data_pack))
    .done(function() {
      updateOperationTree();
      callbacks.success();
    }).fail(function() {
      callbacks.error();
    });

  }


  function submit_job(wizard, data, destination, callbacks) {
    // grab all the user-set options, overwriting the default ones

    // dialog.find("#custom_flagoption_div").each(
    //
    // function () {
    //   console.log($(this).find("input#flagoption").attr("value"))
    //   data.user_flags[$(this).find("input#userflag").attr("value")] = {
    //     "value": $(this).find("input#flagoption").attr("value"),
    //     "help": ""
    //   }
    // })

    data.jobname = wizard.el.find('#job_name').val();

    replication = wizard.el.find('#numjobs').val();

    // UGLY ALERT:

    data_pack = data
    var job_protocol = $('.current-protocol').attr('id');
    if ( FormJobProcessor[job_protocol] != undefined ) {
      FormJobProcessor[job_protocol](data)
    }
    data_pack["flags_file"] = wizard.el.find('#txt_flag_file').val()
    data_pack["operation_info"] = {
      "short": data.jobname,
      "long": data.jobname
    }
    data_pack["pdbdata"] = $('#pdb_src').val()

    // if (data.xmlscript !== undefined) {
    //   data_pack["xmlscript"]["content"] = data.xmlscript;
    // }


    if (destination == "backend" || destination === undefined) {
      launch_tasks(data_pack, replication, callbacks)
    } else if (destination == "nacls") {
      //console.log( JSON.stringify( data_pack ) )
      common.naclModule.postMessage(JSON.stringify(data_pack))


    } else {
      alert("CODERROR");
    }
  }


  function download(query,callbacks) {
    var baseURL = '';
    if (query.substr(0, 4) == 'pdb:') {
      query = query.substr(4).toUpperCase();
      if (!query.match(/^[1-9][A-Za-z0-9]{3}$/)) {
        return;
      }
      uri = "http://www.pdb.org/pdb/files/" + query + ".pdb";
    } else if (query.substr(0, 6) == 'local:') {
      query = query.substr(6);
      uri = "data/pdbs/" + query
        //console.log("URI:" + uri);
    } else if (query.substr(0, 4) == 'cid:') {
      query = query.substr(4);
      if (!query.match(/^[1-9]+$/)) {
        alert("Wrong Compound ID");
        return;
      }
      uri = "http://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + query +
        "/SDF?record_type=3d";
    }

    // $('#loading').show();
    $.get(uri, function(ret) {
      // $("#glmol01_src").val(ret);
      // glmol01.loadMolecule();
      // $('#loading').hide();
      $('#pdb_src').val(ret);
      callbacks.success();
  }).error(callbacks.error).always(callbacks.always);
  }

  //Validation functions:
  var validate_pdb_card = function(card) {
    var pdb_src_len = $('#pdb_src').val().length;
    var radio = card.el.find('input:radio:checked');
    if (pdb_src_len == 0) {
      $('#pdb_file_error_container').collapse('show');
      return false;
    } else {
      $('#pdb_file_error_container').collapse('hide');
    }
    return true;
  }






  var wizard = $("#new_job_wizard").wizard({
    contentHeight: 500,
    contentWidth: 700
  });

  //clearing the current protocol flag:

  //Setting toggle behavior off for error containers
  $('.error_container').collapse({
    toggle: false
  });

  var card_pdb_file = wizard.cards['card_pdb_file'];

  card_pdb_file.on("validate", validate_pdb_card);

  $('#pdb_local_file').change(function() {
      loadFile($('#pdb_local_file').get(0),function() {
          $('#pdb_src').val(result);
      });
  });

  $('#btn_pdb_download').click(function(e) {
      e.preventDefault();
      $("#pdb_download_spinner").show();
      $("#pdb_download_ok").hide();
      $("#pdb_download_error").hide();
      var pdb_id = $("#text_pdb_id").val()
    download('pdb:' + pdb_id, {
        success: function() {
            $("#pdb_download_ok").show();
        },
        error: function() {
            $("#pdb_download_error").show();
        },
        always: function() {
            $("#pdb_download_spinner").hide();
        }
    });
});
  $('#btn_new_job').click(function() {
    wizard.show();
  });

  card_pdb_file.el.find('input:radio').click(function(ev) {
    $('#pdb_src').val('');
    $('input[name="' + $(this).attr('name') + '"]').not($(this)).trigger('deselect');
    $(this).trigger('select');
    $(ev.target).closest('div.radio').find('input:text,input:file').prop('disabled', false);
  });

  wizard.cards['card_pdb_file'].el.find('input:radio').on('deselect', function(ev) {
    $(ev.target).closest('div.radio').find('input:text,input:file').prop('disabled', true);
  });

  //Add ignore_unrecognized_res and ignore_zero_occupancy every time a structure from the pdb is selected
  $("#radio_upload_pdborg").on("select",function(ev){
      $("#txt_flag_file").val("-ignore_zero_occupancy 0\n-ignore_unrecognized_res 1\n")
  }).on("deselect",function(ev){
      $("#txt_flag_file").val("");
  });

  //Second (Protocols) Card:

  var validate_protocol_selection = function(card) {
    var selection = card.el.find('.active');
    if (selection.length == 1) {
      $('#protocol_selection_error_container').collapse('hide');
      return true;
    }
    $('#protocol_selection_error_container').collapse('show');
    return false;
  }

  wizard.cards['card_protocol'].on('validate', validate_protocol_selection);


  //initialize selection ui:
  $('#protocol_selection .list-group-item').not('a[data-toggle="collapse"]').click(function(ev) {
    $('#protocol_selection_error_container').collapse('hide');
    $('#protocol_selection .list-group-item').removeClass('active');
    $(ev.target).addClass('active');

    //Make the next card available + hide the ones that are not available
    $('.protocol-configuration-card').hide();
    var next_card = $(ev.target).data('protocol');
    var protocol_url = $(ev.target).data('protocol-data');
    $('#protocol_data_url').val(protocol_url);

    $('.current-protocol').removeClass('current-protocol');
    $(next_card).addClass('current-protocol'); //in order to fetch when submitting ...

    if ( $(next_card).attr('id') == "backend_diagrams" ){
      $("#wizard_rosetta_diagrams").html('');

      RosettaDiagrams.DiagramsCollection.each(function(diagram){

        var diagram_name = diagram.get('name') || "Untitled Diagram";
        var row_string = "<a href='#demo4' class='list-group-item diagram-list-item' data-id='" + diagram.get('id') + "'>" + diagram_name + "</a>"
        $("#wizard_rosetta_diagrams").append(row_string);


      });

      $("#wizard_rosetta_diagrams a").click(function(ev){

        $(ev.target).addClass('active');

      })

    }

    $(next_card).show();
  });

  $('#wizard_add_file').click(function() {
      $("#wizard_file_list").append(create_file_div({filename:"Filename"}));
  });

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


  function create_file_div(user_file) {
      var thediv = $('<div class="virtual_file"></div>');
      thediv.append("<h5>Virtual File</h5>").append("<input value='" + user_file.filename + "' class='form-control' style='display:inline;'/> ");

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
          'class': 'filechooser form-control',
          'type': 'file',
          'size': '1'
      }).hide()
      filename_field.change(function () {
          loadFile(filename_field.get(0),function(result) {
              textfield.val(result)
          });
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

  //Submission:
  var submit_function = function(wizard) {
    var url = $('#protocol_data_url').val();
    load_job_data(url, function(data) {
      submit_job(wizard, data, "backend", {
        success: function() {
          wizard.submitSuccess();
          wizard.updateProgressBar(0);
        },
        error: function() {
          wizard.submitFailure();
        }
      })
    });
  }

  wizard.on("submit", submit_function);
  wizard.on("submitSuccess", function(wizard) {
    wizard.reset();
    wizard.close();
  });
  $(wizard.el).on("hidden.bs.modal",function() {
      wizard.submitFailure();
      wizard.close();
      wizard.reset();
  });

  wizard.cards['finalize_confirm'].on('selected',function(event,callback){
      var xml_code = "";
     if ( $('.diagram-list-item.active').length == 0) {

         xml_code = $('#rscripts_text').val();

     }
     else {

         var diagram_id = $('.diagram-list-item.active').data('id');

         RosettaDiagrams.DiagramsCollection.each(function(diagram){
             if ( diagram.get('id') == diagram_id ) {
                 xml_code = RosettaDiagrams.get_rosetta_scripts(diagram)
             }
         });

     }

     var job_name = $('#job_name').val();
     var numjobs = $('#numjobs').val();
     var flags = $('#txt_flag_file').val();

     $('#final_code').text(xml_code);
     prettyPrint();
     var job_name_elem = $('<p><b>'+job_name+"</b> (" +numjobs + " jobs)</p>");
     $('#final_job_details').append(job_name_elem)
     if ( flags.length > 0 ){
         var flags_elem = $('<p style="display:block;">Flags: </p> <pre>'+flags+'</pre>');
         $('#final_job_details').append(flags_elem);
     }

  });

  wizard.on("closed",function(wizard) {
      wizard.reset();
  })

  wizard.on("reset", function(wizard) {
     wizard.updateProgressBar(0);
     $("#pdb_download_ok").hide();
     $("#pdb_download_error").hide();
     $("#pdb_download_spinner").hide();
     $("#wizard_file_list").html("");
     $(wizard.el).find('input[type=text]').val("");
     $('#pdb_src').val("");
     $('#final_job_details').html('');
     $('#final_code').text('').removeClass('prettyprinted');
     $(wizard.el).find('.list-group-item').removeClass('active');
     $(wizard.el).find('input[type=radio]').prop('checked',false);
  });

})(jQuery);
