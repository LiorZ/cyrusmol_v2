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
  var loadFile = function() {
    var file = $('#pdb_local_file').get(0);
    if (file) file = file.files;
    if (!file || !window.FileReader || !file[0]) {
      alert("No file is selected. Or File API is not supported in your browser. Please try Firefox or Chrome.");
      return;
    }
    //$('#loading').show();
    var reader = new FileReader();
    reader.onload = function() {
      //$('#glmol01_src').val(reader.result);
      //glmol01.loadMolecule();
      //$('#loading').hide();
      $('#pdb_src').val(reader.result);
    };
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

    console.log(data_pack)

    if (destination == "backend" || destination === undefined) {
      launch_tasks(data_pack, replication, callbacks)
    } else if (destination == "nacls") {
      //console.log( JSON.stringify( data_pack ) )
      common.naclModule.postMessage(JSON.stringify(data_pack))


    } else {
      alert("CODERROR");
    }
  }


  function download(query) {
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
    });
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

  $('#pdb_local_file').change(loadFile);
  $('#text_pdb_id').focusout(function() {
    download('pdb:' + $(this).val());
  })
  $('#btn_new_job').click(function() {
    wizard.show();
  });

  card_pdb_file.el.find('input:radio').click(function(ev) {
    $('#pdb_src').val('');
    $('input[name="' + $(this).attr('name') + '"]').not($(this)).trigger('deselect');
    $(ev.target).closest('div.radio').find('input:text,input:file').prop('disabled', false);
  });

  wizard.cards['card_pdb_file'].el.find('input:radio').on('deselect', function(ev) {
    $(ev.target).closest('div.radio').find('input:text,input:file').prop('disabled', true);
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
        var row_string = "<a href='#demo4' class='list-group-item' data-id='" + diagram.get('id') + "'>" + diagram_name + "</a>"
        $("#wizard_rosetta_diagrams").append(row_string);


      });

      $("#wizard_rosetta_diagrams a").click(function(ev){

        $(ev.target).addClass('active');

      })

    }

    $(next_card).show();
  });

  //Submission:
  var submit_function = function(wizard) {
    var url = $('#protocol_data_url').val();
    load_job_data(url, function(data) {
      submit_job(wizard, data, "backend", {
        success: function() {
          wizard.submitSuccess();
          wizard.hideButtons();
          wizard.updateProgressBar(0);
        },
        error: function() {
          wizard.submitFailure();
          wizard.hideButtons();
        }
      })
    });
  }

  wizard.on("submit", submit_function);
  wizard.on("submitSuccess", function(wizard) {
    wizard.reset();
    wizard.close();
  });

})(jQuery);
