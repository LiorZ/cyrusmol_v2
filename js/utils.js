var _Utils_ = {};

$(function($) {
        _Utils_.download = function(query,callbacks) {
            var baseURL = '';
            if (query.substr(0, 4) == 'pdb:') {
                query = query.substr(4).toUpperCase();
                if (!query.match(/^[1-9][A-Za-z0-9]{3}$/)) {
                    return;
                }
                uri = "http://www.pdb.org/pdb/files/" + query + ".pdb";
            } else if (query.substr(0, 6) == 'local:') {
                query = query.substr(6);
                uri = "data/pdbs/" + query
                //console.log("URI:" + uri);
            } else if (query.substr(0, 4) == 'cid:') {
                query = query.substr(4);
                if (!query.match(/^[1-9]+$/)) {
                    alert("Wrong Compound ID");
                    return;
                }
                uri = "http://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + query +
                "/SDF?record_type=3d";
            }

            // $('#loading').show();
            $.get(uri, function(ret) {
                // $("#glmol01_src").val(ret);
                // glmol01.loadMolecule();
                // $('#loading').hide();
                callbacks.success(ret);
            }).error(callbacks.error).always(callbacks.always);
        }

});
