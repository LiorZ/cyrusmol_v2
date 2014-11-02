var GraphPlotting = (function($) {

  var ENERGIES = [];
  var DATA = [];
  var get_points = function(ax1, ax2) {
    var arr = [];
    for (var i = 0; i < ENERGIES.length; i++) {
      arr.push([ENERGIES[i][ax1], ENERGIES[i][ax2]]);
    }

    return arr;

  }

  function populateAxisSelectBoxes() {
    var energies = ENERGIES[0];
    if (energies == null || energies == undefined) {
      return;
    }

    for (var term in energies) {
      var option = "<option value='" + term + "'>" + term + "</option>";
      $("#select_x_axis").append(option);
      $("#select_y_axis").append(option);
    }
    $('#select_axes').show();
  }

  var draw_graph = function(x_ax, y_ax, data) {
    var data = get_points(x_ax, y_ax);
    $.plot($("#graph_body"), [data], {
      series: {
        points: {
          radius: 3,
          show: true,
          fill: true,
          fillColor: "#058DC7"
        },
        color: "#058DC7",
      },
      grid: {
        clickable:true,
        hoverable:true
      },
      xaxis: {
        axisLabel: x_ax,
        axisLabelUseCanvas: true,
        axisLabelFontSizePixels: 14,
        axisLabelFontFamily: 'Verdana, Arial, Helvetica, Tahoma, sans-serif',
        axisLabelPadding: 5
      },
      yaxis: {
        axisLabel: y_ax,
        axisLabelUseCanvas: true,
        axisLabelFontSizePixels: 14,
        axisLabelFontFamily: 'Verdana, Arial, Helvetica, Tahoma, sans-serif',
        axisLabelPadding: 5
      }
    });

  $("#graph_body").bind("plotclick", function (event, pos, item) {
    var struct_key = DATA[item.seriesIndex].key;
    $.get('/structure/get?key='+struct_key)
    .done(function(data) {
      $("#glmol01_src").val(data.pdbdata).trigger("change");
    })
    .fail(function(){
      alert("Fetching structure failed");
    })
  });

$("#graph_body").bind("plothover", function (event, pos, item) {
    
});

  }

  var plot_graph = function(structure_key) {

    $.get('/structure/query?parental_hash=' + structure_key)
      .done(function(data) {
        ENERGIES = [];
        DATA = data;
        for (var i = 0; i < data.length; ++i) {
          ENERGIES.push(JSON.parse(data[i].energies));
        }

        draw_graph('irms', 'score', data);
        populateAxisSelectBoxes();

      });

  }


  //Init controls:

  $('#select_axes select').change(function(event) {

    var x_ax = $('#select_x_axis option:selected').text();
    var y_ax = $('#select_y_axis option:selected').text();
    draw_graph(x_ax, y_ax, ENERGIES);
  });

  return {
    plot_graph: plot_graph
  }


})(jQuery)
