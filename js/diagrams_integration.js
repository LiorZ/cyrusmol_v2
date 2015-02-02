$(function($) {

  var DiagramListView = Backbone.View.extend({
    el: "#tbl_rosetta_diagrams",
    events: {
      'click a': 'open_diagram',
      'click .delete-diagram': 'delete_diagram',
      'click .publish-diagram': 'publish_diagram',
      'click .share-code':'display_share_code'
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

    display_share_code: function(ev){
      var id = this.get_button_id(ev);
      $('#code-placeholder').text(id);

      $('#share-code-modal').modal('show');

    },

    get_button_id: function(ev) {
      var td = $(ev.target).parents('td');
      var button = td.find('.publish-diagram');
      var id = button.attr('data-id');

      return id;
    },

    publish_diagram: function(ev){
      id = this.get_button_id(ev);

      var td = $(ev.target).parents('td');
      var button = td.find('.publish-diagram');

      var model = RosettaDiagrams.DiagramsCollection.findWhere({id: id});
      var is_public = model.get('is_public');

      if ( is_public == undefined )
        is_public = false;

      model.set('is_public',!is_public);
      model.save(null,{
        success: function() {
          if ( !is_public ){
            button.text("Public").addClass('btn-danger').removeClass('btn-success')
          }else {
            button.text("Private").addClass('btn-success').removeClass('btn-danger');
          }
        }
      });
    },

    get_button_string: function(model){
      var is_public = "Private";
      var classname = "btn-info"
      if ( model.get('is_public') == true) {
        is_public = "Public";
        classname = "btn-danger"
      }
      var str = "<button type=button class='btn btn-xs pull-right publish-diagram " + classname +"' data-id='"+model.get('id')+"' data-toggle=button aria-pressed=false autocomplete=off>"+
      is_public+"</button>";

      return str;
    },

    get_tr_string: function(model) {
      var tr_string = "<tr><td><a href='#' data-id='" + model.get('id') + "'>" + model.get('name') +
      "</a></td><td> \
      <button class='btn btn-primary btn-xs pull-right delete-diagram' style='margin-left:0.5em;' data-id='"+model.get('id')+"'> <span class='glyphicon glyphicon-remove'></span></button>"+
      this.get_button_string(model)+
      "<button class='btn btn-primary btn-xs pull-right share-code' style='margin-right:0.5em;'>Share Code</button>"+
      "</td></tr>";

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
        var g = new RosettaDiagrams.RosettaDiagramsGraph();
        if ( data[i].cells === undefined ){
          data[i].cells = [];
        }
        g.fromJSON(data[i], {graph: g});
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

  $('#btn_import_diagram').click(function() {
    $("#import-diagram-dialog").modal("show");
  });

  $("#btn_dialog_import_diagram").click(function() {
    var id = $('#import-diagram-share-code').val();
    $.post("/import/"+id).done(function(data){
      var g = new RosettaDiagrams.RosettaDiagramsGraph();
      g.fromJSON(data,{graph:g});

      RosettaDiagrams.DiagramsCollection.add(g);
      $("#import-diagram-dialog").modal("hide");
    }).error(function() {
      alert("Error");
    });
  })




}(jQuery));
