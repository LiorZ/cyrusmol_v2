function prepareData(data) {

  var arr = [];
  for (var i = 0; i < data.length; i++) {
    var info = jQuery.parseJSON(data[i].info);

    var new_obj = {
      text: info.short,
      tags: [data[i].replication],
      structure_hash: data[i].structure_hash
    }
    arr.push(new_obj);
  }

  return arr;

}


function nodeSelected(event,node) {
    GraphPlotting.plot_graph(node.structure_hash);
}


function updateOperationTree() {
  $.get('/operation/list?parentkey=')
    .done(function(data) {
      $("#job_tree").treeview({
        data: prepareData(data),
        showTags: true,
        onNodeSelected:nodeSelected
      });


    })
    .fail(function(err) {
      alert("Error fetching data");
    })
}


//Run on startup:


$('#btn_update_op_list').click(function() {
  updateOperationTree();
});
updateOperationTree();
