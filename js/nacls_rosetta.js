
// Called by the common.js module.
function moduleDidLoad() {
  // The module is not hidden by default so we can easily see if the plugin
  // failed to load.
  common.hideModule();
}

// Called by the common.js module.
function attachListeners() {
//  document.getElementById('run_rosetta').addEventListener('click', run_rosetta);
}

function launch_rosetta_pose_operation( poseops ) {
  job_data = {
     "title":"Score Structure using Rosetta Energy Function",
     "jobname": "Pose Op example",
     "command":"poseop",
     "user_files":[ ],
     "forced_flags":[ ],
     "user_flags":{ },
     "poseop" : poseops 
  }
  job_data["pdbdata"] = $('#glmol01_src').val()

  job_data_json = JSON.stringify( job_data );
  console.log( job_data_json )
  common.naclModule.postMessage(job_data_json)
}

function test_pose_operations() {
  poseop = [] 
  for( i=1; i < 50; i ++ ){
      poseop.push({
          "op": "set_psi",
          "seqpos": i,
          "value" : 45.1
      });
      poseop.push({
          "op": "set_phi",
          "seqpos": i,
          "value" : 45.1
      });
      poseop.push({
          "op": "set_omega",
          "seqpos": i,
          "value" : 45.1
      });
  }
  launch_rosetta_pose_operation( poseop )
}


// Called by the common.js module. Handles returning messages from the Rosetta NACLS module
function handleMessage(message_event) {
  try{ 
    reply = $.parseJSON(message_event.data);
  }
  catch( err ){
    console.log("NACLS Non-json reply: " + message_event.data ); 
    return;
  }
    
  if( reply.pdbdata !== undefined ){
    load_pdbdata_into_view( reply.pdbdata ); 
  }
  if( reply.error !== undefined ){
    alert( reply.error ); 
    console.log( "ROSETTA ERROR: " + reply.error ); 
  }
}







