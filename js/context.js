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
// global hook to funtion for outside to be able to open job dialog. Need cleaner solution here // mtyka




// function to open a small dialog to ask for some arbitrary values
// Parameters:  data
//          object with the following structure
//{
//  name: "Window name",
//  options: [
//    { name: "Option1", value: "10" , type: "int" },
//    { name: "Option2", value: "alala", type: "string" },
//    { name: "Option4", value: "30.00", type: "real" }
//    // ....
//  ]
//}

function open_value_dialog(data, callback ) {

  function create_parameter_set_div( options ){

    fieldset = $('<fieldset id="options_select"><legend>Options:</legend></fieldset>')
    for (option in options) {
      fieldset.append($('<div></div>', {
        'id': options[option].name,
        'class': 'parameters_div'
      })
      .append($('<span></span>').html(options[option].name + " = &nbsp; "))
      .append($('<input></input>', {
      'id': 'parameter',
      'value': options[option]["value"]
      })))
    }
    return $("<div></div>").append(fieldset).append($("<p>"));
  }
  
  // ok, create the element and fill it with fields
  dialog = $('<div></div>', {
    'id': "param_dialog",
    title: data.name
  })

  dialog.append( create_parameter_set_div( data.options ) )
  
  $("body").append(dialog)
  dialog.dialog({
    height: 250,
    width: 400,
    buttons: {
      "OK": function () {
        // fill the data object with the values from the HTML fields
        for (option in data.options) {
          data.options[option].value = dialog.find("div#"+data.options[option].name).find("input#parameter").val()
        }
        // call the callback function
        callback( data )
        // get rid of dialog
        $(this).dialog().dialog("close");
      },
      "Cancel": function () {
        // just get rid of dialog
        $(this).dialog().dialog("close");
      }
    }
  })

}

function testme(){

//data = {
//  "name": "Window name",
//  "options": [
//    { "name": "Option1", "value": "10" , "type": "int" },
//    { "name": "Option2", "value": "alala", "type": "string" },
//    { "name": "Option4", "value": "30.00", "type": "real" }
//    // ....
//  ]   
//}
//
//open_value_dialog( data, function( ret ){ console.log( ret ); } );


  


}


//  { "name": "Sequence Position", "value": "1" , "type": "int" },
//"options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]   
//"options": [  { "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]   


pose_operations = [
{"op" :"set_phi",      "name":"Set backbone phi"     , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_psi",      "name":"Set backbone psi"     , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_omega",    "name":"Set backbone omega"   , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_alpha",    "name":"Set backbone alpha"   , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_beta",     "name":"Set backbone beta"    , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_gamma",    "name":"Set backbone gamma"   , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_delta",    "name":"Set backbone delta"   , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_epsilon",  "name":"Set backbone epsilon" , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]    },
{"op" :"set_zeta",     "name":"Set backbone zeta"    , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ]   },
{"op" :"set_chi_nucl", "name":"Set nucleinc acid side-chain chi_nucl", "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" } ,{ "name" : "value", "label": "Torsion Angle", "value": "0.0", "type": "real" } ] }, 

{"op" :"set_chi",      "name":"Set protein side-chain chi"     , "options": [  { "name" : "seqpos", "label": "Sequence Position", "value": "1", "type": "int" }, { "name" : "chino", "label": "Chi Number", "value": "1", "type": "int" }, { "name" : "value", "label": "Torsion Angle", "value ": "0.0", "type": "real" } ] }
]



function launch_poseop_for_selected_residues( user_poseop ){
 selected_residues = glmol01.get_selected_residue_numbers()

 poseops = [];
 console.log( user_poseop )
 for ( residue in selected_residues ){
   console.log( residue )
   newop = { "op": user_poseop["op"] }
   for( opt in user_poseop["options"] ){
     option =  user_poseop["options"][opt]
     if( option["type"] == "real" ) { newop[ option["name"] ] = parseFloat( option["value"] ) }
     if( option["type"] == "int" ) { newop[ option["name"] ] = parseInt( option["value"] ) }
   }
   // overwrite seqpos with the residue number we're looping over  
   newop["seqpos"] = parseInt( residue );
   poseops.push(newop)
 }

 console.log( poseops )
 launch_rosetta_pose_operation( poseops ) 
 console.log( poseops ) 
}


function create_poseop_context_menu(){
 var ul = $("<ul></ul>", { "id":"poseopmenu" } )
 for(poseop in pose_operations){
   // create a list item and attach a data object under the name "poseop" containing the respective code operation json object (pose_operations[poseop]) 
   var li = $("<li></li>").data( { "poseop" : pose_operations[poseop]}  )
   // add the text of the menu item too
   li.append('<a href="#">'+pose_operations[poseop]["name"]+'</a>')
   // add it to the menu
   ul.append(li) 
 } 

 // attach event for when menu is clicked.
 ul.on( "menuselect", function( event, ui ) { 
  var poseop = ui.item.data("poseop");  
  console.log( poseop )
  $("#poseopmenu").hide();
  
  open_value_dialog( poseop, function ( mod_poseop ) {
    launch_poseop_for_selected_residues( mod_poseop );
  })

 } );

 return ul;
}


// Create the context menu (hidden), ready for use and set up event handlers
$( function() {
 
  menu = create_poseop_context_menu();
 $("body").append( menu )
 $("#poseopmenu").menu();

} )


