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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// This module implements graph window manipulation
(function ($) {

  // private vars - these should really move into the DOM object since there should be one per independent graph.
  var graph_puller;
  var last_parental_hash = ""
  var last_graph_data = undefined


    function create_graph(jqobj, dataPoints) {
      console.log(dataPoints)
      // ok, load up a D3 scatter plot

      // Variables that define properties of the visualization.  `margin` is the
      // number of pixels allotted for annotations (axis labels, etc) around the
      // outside of the plot.  `r` is the radius of the circles.
      var margin = 100;
      var r = 3;
      var numTicks = 10;

      // The dimensions of the plot are the dimensions of the HTML div element, minus
      // the margin size.
      var w = $(jqobj).width() - margin;
      var h = $(jqobj).height() - margin;

      // `x` and `y` convert expresion values to pixel position. The domains of these
      // scales (the range of expression values) will be computed dynamically later.
      var x = d3.scale.linear().range([0, w]);
      var y = d3.scale.linear().range([h, 0]);

      // Initialize the chart element.  The translation transform displaces the
      // chart by half the margin size.
      // Zap the previous contents.
      $(jqobj).empty();

      // add new SVG
      var vis = d3.select(jqobj).append("svg:svg")
        .attr("viewBox", "0 0 " + w + " " + h)
        .attr("preserveAspectRatio", "xMinYMid")
        .append("svg:g")
        .attr("transform", "scale(0.85,0.9) translate(" + w / 10 + "," + h / 20 + ")")


      // Update the domain of the x and y scales. It can be helpful if the axes
      // have the same domain so that the slope of the line fit to the data
      // points is clearer.
      if (dataPoints.length > 0) {
        var domainx = [dataPoints[0].x, dataPoints[0].x];
        var domainy = [dataPoints[0].y, dataPoints[0].y];
        for (var i = 1; i < dataPoints.length; i++) {
          p = dataPoints[i];
          domainx[0] = Math.min(p.x, domainx[0]);
          domainx[1] = Math.max(p.x, domainx[1]);
          domainy[0] = Math.min(p.y, domainy[0]);
          domainy[1] = Math.max(p.y, domainy[1]);
        }
        domainx[0] = Math.floor(domainx[0]);
        domainx[1] = Math.ceil(domainx[1]);
        domainy[0] = Math.floor(domainy[0]);
        domainy[1] = Math.ceil(domainy[1]);
        x.domain(domainx);
        y.domain(domainy);

        numTicks = domainx[1] - domainx[0] + 1;

        // don't want there to be too many ticks
        var newTicks = numTicks;
        var factor = .5;
        while (newTicks > 12) {
          newTicks = Math.ceil(numTicks * factor);
          factor *= .5;
        }

        numTicks = newTicks;
      }

      var axisGroup = vis.append("svg:g").attr("class", "axes");
      axisGroup.selectAll("line.xticks").data(x.ticks(numTicks))
        .enter().append("svg:line")
        .attr("class", "xtick")
        .attr("x1", x)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", h)
        .attr("stroke", "#777");

      axisGroup.selectAll("line.yticks").data(y.ticks(numTicks))
        .enter().append("svg:line")
        .attr("class", "ytick")
        .attr("x1", w)
        .attr("y1", y)
        .attr("x2", 0)
        .attr("y2", y)
        .attr("stroke", "#777");

      // These two calls simply add the x and y axes.
      axisGroup.append("svg:line")
        .attr("stroke-width", 2)
        .attr("stroke", "white")
        .attr("x1", 0)
        .attr("y1", h)
        .attr("x2", w)
        .attr("y2", h);

      axisGroup.append("svg:line")
        .attr("stroke-width", 2)
        .attr("stroke", "white")
        .attr("x1", 0)
        .attr("y1", h)
        .attr("x2", 0)
        .attr("y2", 0);

      // Add the scatter plot circles.  Their positions are set by the `cx` and `cy`
      // properties.  We set those attributes by a function that takes a data value
      // and maps its expression values through the `x` and `y` scales.
      var pointGroup = vis.append("svg:g").attr("class", "points");
      pointGroup.selectAll("circle.points").data(dataPoints)
        .enter().append("svg:circle")
        .attr("class", "point")
        .attr("cx", function (d) {
        return x(d.x);
      })
        .attr("cy", function (d) {
        return y(d.y);
      })
        .attr("r", r)
        .attr("fill", function (d) {
        return d.color;
      })
        .on("click", mouseclick);

      // Finally, we draw text labels next to the x and y axes that indicate the
      // data values at the tick positions we drew awhile ago.  Note that these
      // positions have to be offset a bit so that they don't actually sit on the
      // axes themselves.
      pointGroup.selectAll("text.xlabels").data(x.ticks(numTicks))
        .enter().append("svg:text")
        .attr("class", "xlabel")
        .attr("fill", "white")
        .attr("x", x)
        .attr("y", h)
        .attr("dx", 0)
        .attr("dy", 13)
        .text(function (d) {
        return d;
      });

      pointGroup.selectAll("text.ylabels").data(y.ticks(numTicks))
        .enter().append("svg:text")
        .attr("class", "ylabel")
        .attr("fill", "white")
        .attr("x", 0)
        .attr("y", y)
        .attr("dx", -30)
        .attr("dy", 0)
        .text(function (d) {
        return d;
      });


      // When the mouse enters one of the data elements, display its properties
      // and highlight its properties by adding a stroke and making it bigger. We
      // have to keep track of which element is currently being highlighted so
      // that we can remove the highlight when it changes.
      var highlightElement = null;

      function mouseclick(d) {
        console.log(d.key);
        loadFromDatastoreIntoView(d.key)

        var element = d3.select(this);
        element.transition().duration(30)
          .attr("r", r + 3)
          .attr("stroke", "black")
          .attr("fill", "red");

        if (highlightElement) {
          highlightElement.transition().duration(30)
            .attr("r", r)
            .attr("stroke", "none")
            .attr("fill", "white");
        }
        highlightElement = element;
      }


    }



    function draw_graph(me, default_axes) {
      obj = $(me)
      // Clear the Div - so we can put new stuff in it
      obj.empty()

      // retrieve the data from the DOM (through jQuery) 
      var jsondata = $.data(me, "graphdata")

      // grab the energylist from the first structure (assume they're all the same.. hmm ., not great)
      // TODO: mtyka add code to parse through all structures and get all energy types ?? 
      var energies = $.parseJSON(jsondata[0].energies)

      // make a list of energy names 
      keylist = []
      for (var key in energies) {
        keylist.push(key)
      }
      console.log(keylist)

      // ok, now go through all the axes and create a selector to pick what energy value to plot 
      axes = ["y", "x"]
      axes.forEach(function (axis) {
        console.log(axis)
        selector = $("<select></select>", {
          id: "select_" + axis + "axis"
        })

        // populate the selector with all the possiblities
        keylist.sort().forEach(function (energy_name) {
          option = $('<option></option>', {
            'value': energy_name
          })
          if (energy_name == default_axes[axis]) {
            option.attr("selected", "1")
          }
          option.html(energy_name)
          selector.append(option)
        })

        // set the function to deal with the user changing the value - triggers a redraw with the newly chosen axes  
        selector.change(function (fevent) {
          selected_option = $(this).find(":selected").attr("value");
          // set the appropriate axis (stored in the loop variable 'axis' ) to the chosen energy name
          default_axes[axis] = selected_option;
          draw_graph(me, default_axes)
        })

        // finally add the selector to the DOM
        obj.append(axis + ": ")
        obj.append(selector)
        obj.append(" &nbsp; &nbsp; ")
      })

      // create the div that ctually hodl the D3 graph itself
      chartCell = $("<div></div>", {
        "id": "chartCell",
        "style": "width:100%; height: 50%; background-color: #transparent; color: white; z-index: 30"
      })

      // append it and also draw some axis labels
      obj.append(chartCell)
      //obj.append( $( "<div></div>", { "id":"xaxislabel", "style":" position:relative; bottom: 20px; left: 50%; margin-left: -20%; z-index: 20; width: 40% " } ).append( $("<center>" + default_axes["x"] + "<center>") ) ) 
      //obj.append( $( "<div></div>", { "id":"yaxislabel", "style":" position:relative; bottom: 50%; left:  7px; z-index: 20;" } ).html(  default_axes["y"] ) ) 

      // now construct the graph_data according to which data we should plot on which axis.
      graph_data = [];
      for (i in jsondata) {
        var struct = jsondata[i]
        var energies = $.parseJSON(struct.energies)
        console.log(energies);
        graph_data.push({
          "x": energies[default_axes["x"]],
          "y": energies[default_axes["y"]],
          "key": struct.key,
          "hash": struct.hash,
          "name": "lala",
          "structure": "Check",
          "donor": "Donor field",
          "color": "#ffffff"
        })
      }

      console.log(graph_data)

      create_graph("#chartCell", graph_data);

    }




    // create a jquery function to manage graphs
    $.fn.r_energy_graph = function (parental_hash, axes) {
      me = this;
      // empty out html container
      obj = $(this)

      loadStructuresByParent("parental_hash=" + parental_hash, function (jsondata) {
        // store the raw data locally
        $.data(me, "graphdata", jsondata)
        console.log($.data(me, "graphdata"))
        draw_graph(me, axes)
        console.log("Updated graph...");
        //    if( (parental_hash != last_parental_hash) ||  // is it a different dataset ?
        //        graph_data.length != last_graph_data.length ) // or is there new data ?
        //    {
        //      last_parental_hash = parental_hash;
        //      last_graph_data = graph_data ;
        //    }
        //
        //    clearTimeout( graph_puller );
        //    graph_puller = setTimeout( function(){ loadGraphByParent( parental_hash )} , 10000 )
      })

      return obj
    }

}(jQuery));
