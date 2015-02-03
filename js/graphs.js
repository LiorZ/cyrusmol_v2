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

  function showTooltip(x, y, contents) {
    $('<div id="tooltip">' + contents + '</div>').css({
      position: 'absolute',
      display: 'none',
      top: y + 5,
      left: x + 5,
      border: '1px solid #fdd',
      padding: '2px',
      'background-color': '#fee',
      opacity: 0.80
    }).appendTo("body").fadeIn(200);
  }

  function loadStructure(data) {
    $("#glmol01_src").val(data.pdbdata).trigger("change");
  }

  function updateEnergyTable(data){

    $(".table_energy_term").remove();
    var json_energies = JSON.parse(data.energies);

    var keys =[];
    for (var key in json_energies) {
      keys.push(key);
    }

    keys.sort().reverse();

    for (var i=0; i<keys.length; ++i) {
      var row = "<tr class='table_energy_term'><td>"+keys[i]+"</td><td>"+Math.round(json_energies[keys[i]]*1000)/1000+"</td></tr>";
      $("#energy_table_header").after(row);
    }

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
        clickable: true,
        hoverable: true
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

    $("#graph_body").bind("plotclick", function(event, pos, item) {
      var struct_key = DATA[item.dataIndex].key;
      $.get('/structure/get?key=' + struct_key)
        .done(function(data) {
          loadStructure(data);
          updateEnergyTable(data);
        })
        .fail(function() {
          alert("Fetching structure failed");
        })
    });

    $("#graph_body").bind("plothover", function(event, pos, item) {
      $("#tooltip").remove();
      if (item) {
        var x = item.datapoint[0].toFixed(2),
          y = item.datapoint[1].toFixed(2);
        showTooltip(item.pageX, item.pageY, "Decoy " + item.dataIndex + " " + x + " , " + y);
      }
    });

  }

  var plot_graph = function(structure_key) {

    $.get('/structure/query?parental_hash=' + structure_key)
      .done(function(data) {
        ENERGIES = [];
        DATA = data;
        for (var i = 0; i < data.length; ++i) {
          var energy_entry = JSON.parse(data[i].energies);
          if ( _.keys(energy_entry).length > 0){
            ENERGIES.push(energy_entry);
          }
        }
        $('#select_x_axis').val("irms");
        $('#select_y_axis').val("score");
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
