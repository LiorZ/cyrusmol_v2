$(function($) {

  var DiagramListView = Backbone.View.extend({
    el: "#tbl_rosetta_diagrams",
    events: {
      'click a': 'open_diagram',
      'click button': 'delete_diagram'
    },

    initialize:function() {

      this.listenTo(RosettaDiagrams.DiagramsCollection,"add",this.add_diagram_to_table);
      this.listenTo(RosettaDiagrams.DiagramsCollection,"change:name",this.change_diagram_name);
      this.listenTo(RosettaDiagrams.DiagramsCollection,"remove",this.remove_diagram);

    },

    render: function() {
      var arr = RosettaDiagrams.DiagramsCollection;
      for (var i = 0; i < arr.length; ++i) {
        var tr_string = this.get_tr_string(arr.at(i));
        this.$el.append(tr_string);
      }
    },

    get_tr_string: function(model) {
      var tr_string = "<tr><td><a href='#' data-id='" + model.get('id') + "'>" + model.get('name') + "</a></td><td><button class='btn btn-primary btn-xs pull-right' data-id='"+model.get('id')+"'> <span class='glyphicon glyphicon-remove'></span></button></td></tr>";

      return tr_string;
    },
    change_diagram_name: function(model) {
      var id = model.get('id');
      this.$el.find("td a[data-id="+id+"]").text(model.get('name'));
    },
    add_diagram_to_table: function(new_model) {
      this.undelegateEvents();
      var tr_string = this.get_tr_string(new_model);
      this.$el.append(tr_string);
      this.delegateEvents();
    },
    open_diagram: function(ev) {
      var id = $(ev.target).attr('data-id');
      var diagram = RosettaDiagrams.diagram_by_id(id);
      if (diagram !== undefined) {
        var open_diagram_func = function(e) {
          RosettaDiagrams.open_existing_diagram(diagram);
          $('#rosetta_diagrams_view').off('shown.bs.modal',open_diagram_func);
        };
        $('#rosetta_diagrams_view').on('shown.bs.modal', open_diagram_func );
        $('#rosetta_diagrams_view').modal('show');
      }
    },
    delete_diagram: function(ev) {
      console.log("Deleting diagram");
      var td = $(ev.target).parents('td');
      var id = td.find('button').attr('data-id');
      var diagram = RosettaDiagrams.DiagramsCollection.findWhere({id: id});
      diagram.destroy();
      td.parents('tr').remove();
    },
    remove_diagram: function(model){
      console.log("Removing Diagram! ");
      console.log(model);
    }
  });

  var diagram_view = new DiagramListView();
  // RosettaDiagrams.DiagramsCollection.fetch(
  //   {
  //     success: function() {
  //     },
  //     error:function(){
  //
  //     }
  // });

  $.get('/diagrams').done(function(data){
    if ( data != undefined && data.length > 0 ){
      var arr = [];
      for (var i=0; i<data.length; ++i) {
        var g = new joint.dia.Graph();
        if ( data[i].cells === undefined ){
          data[i].cells = [];
        }
        g.fromJSON(data[i]);
        arr.push(g);
      }
      RosettaDiagrams.DiagramsCollection.reset(arr);
      diagram_view.render();
    }
  });


  $('#btn_new_diagram').click(function() {
    $('#rosetta_diagrams_view').modal('show');
    RosettaDiagrams.new_diagram();
  });




}(jQuery));
