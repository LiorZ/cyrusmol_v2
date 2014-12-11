(function($) {
  $('#glmol01_src').change(function(ev) {
    glmol01.loadMolecule();
  });

  function init_glmol() {

    $('#glmol01').contextmenu({
      target:'#glmol-context',
      onItem:function(context,e){

      }

    });

  }


  try{
    var glmol01 = new GLmol('glmol01', true);
    init_glmol();
  }
  catch(e){
    setTimeout(function(){
      $('#notifications #warning-message').html("Error occurred while initializing WebGL. You won't be able to see molecules in 3d.");
      $('#notifications').animate({opacity:"toggle", height:"toggle"});
    },1000)
  }



})(jQuery);
