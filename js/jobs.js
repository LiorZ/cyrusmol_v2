var selected_node;

function prepareData(data) {

  var arr = [];
  for (var i = 0; i < data.length; i++) {
    var info = jQuery.parseJSON(data[i].info);

    var new_obj = {
      text: info.short,
      tags: [{
        markup:"<span class='label-as-badge alert-warning'></span>",
        value: "Queued: "+data[i].replication
      },
      {
        markup: "<span class='label-as-badge alert-success'></span>",
        value: "Success: "+data[i].count_results
      },
      {
        markup:"<span class='label-as-badge alert-danger'></span>",
        value: "Error: " + data[i].count_errors
      }],
      structure_hash: data[i].structure_hash,
      operation_key: data[i].key
    };
    arr.push(new_obj);
  }

  return arr;

}

function nodeSelected(event,node) {
    GraphPlotting.plot_graph(node.structure_hash);
    selected_node = node;
}

function updateOperationTree() {
  $.get('/operation/list?parentkey=')
    .done(function(data) {
      $("#job_tree").treeview({
        data: prepareData(data),
        showTags: true,
        onNodeSelected:nodeSelected,
        tagContainer:"<div class='tag_container'></div>"
      });
    })
    .fail(function(err) {
      alert("Error fetching data");
    });
}

//Run on startup:
$(document).ready(function() {
    $('#btn_update_op_list').click(function() {
        updateOperationTree();
    });
    $("#btn_purge_jobs").click(function() {

        $.post("/operation/deleteall").done(function(data){
            $("#job_tree").empty();
        });;
    });

    $("#btn_download_pdb").click(function(ev) {
        if (!selected_node) {
            return;
        }

        var structure_hash = selected_node.structure_hash;
        var url = "/structure/get_pdbs?parental_hash="+structure_hash;
        var iframe = "<iframe style='display:none;' src='"+url+"'/>";
        $('body').append(iframe);
    });

    $("#show_latest_stderr").click (function(ev) {
        if ( selected_node === undefined ) {
            return;
        }
        $.get('/operation/list',function(data) {
            var operation_stderr;
            if (data === null || data === undefined){
                return;
            }

            for (var i = 0; i<data.length; ++i) {
                if ( data[i].key == selected_node.operation_key ) {
                    operation_stderr = data[i].last_stderr;
                }

            }
            if ( !operation_stderr ) {
                return;
            }

            $("#standard_error_pre").text('').text(operation_stderr).parents('#stderr_view').modal("show");
        });
    });
    updateOperationTree();
})
