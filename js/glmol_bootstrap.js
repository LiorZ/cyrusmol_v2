var glmol_bootstrap = (function($) {
  $('#glmol01_src').change(function(ev) {
    glmol01.loadMolecule();
  });

  try{
    var glmol01 = new GLmol('glmol01', true);
  }
  catch(e){
    alert("Error initializing WebGL");
  }

})(jQuery);
