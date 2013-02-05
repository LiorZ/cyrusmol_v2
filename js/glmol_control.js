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
// Adapted from code by: 
// GLmol - Molecular Viewer on WebGL/Javascript (0.46) - forked and modified by Mike Tyka @ Google
//  (C) Copyright 2011-2012, biochem_fan
//      License: dual license of MIT or LGPL3
function download(query) {
    var baseURL = '';
    if (query.substr(0, 4) == 'pdb:') {
        query = query.substr(4).toUpperCase();
        if (!query.match(/^[1-9][A-Za-z0-9]{3}$/)) {
            alert("Wrong PDB ID");
            return;
        }
        uri = "http://www.pdb.org/pdb/files/" + query + ".pdb";
    } else if (query.substr(0, 6) == 'local:') {
        query = query.substr(6);
        uri = "data/pdbs/" + query
        console.log("URI:" + uri);
    } else if (query.substr(0, 4) == 'cid:') {
        query = query.substr(4);
        if (!query.match(/^[1-9]+$/)) {
            alert("Wrong Compound ID");
            return;
        }
        uri = "http://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + query +
            "/SDF?record_type=3d";
    }

    $('#loading').show();
    $.get(uri, function (ret) {
        $("#glmol01_src").val(ret);
        glmol01.loadMolecule();
        $('#loading').hide();
    });
}

function addTab(tabId, height, zIndex) {
    $(tabId + ' .bottomTab').toggle(

    function () {
        $(tabId).
        css('z-index', 100).
        animate({
            bottom: '0px',
            'height': '400px'
        });
    },

    function () {
        $(tabId).
        css('z-index', zIndex).
        animate({
            bottom: '-385px',
            'height': '400px'
        });
    });
}

function loadFile() {
    var file = $('#glmol01_file').get(0);
    if (file) file = file.files;
    if (!file || !window.FileReader || !file[0]) {
        alert("No file is selected. Or File API is not supported in your browser. Please try Firefox or Chrome.");
        return;
    }
    $('#loading').show();
    var reader = new FileReader();
    reader.onload = function () {
        $('#glmol01_src').val(reader.result);
        glmol01.loadMolecule();
        $('#loading').hide();
    };
    reader.readAsText(file[0]);
}

function saveImage() {
    glmol01.show();
    var imageURI = glmol01.renderer.domElement.toDataURL("image/png");
    window.open(imageURI);
}

function updateRepresentation() {
    glmol01.defineRepresentation = defineRepFromController;
    glmol01.rebuildScene();
    glmol01.show();
}

$('#glmol01_reload').click(function (ev) {
    updateRepresentation();
});

function defineRepFromController() {

    colorscheme = {
        "H": 0xffffff,
        "C": 0x32cd32,
        "N": 0x0000ff,
        "O": 0xff0000,
        "S": 0xffff00
    }

    var idHeader = "#" + this.id + '_';

    var time = new Date();
    var all = this.getAllAtoms();
    var drawHydrogens = ($(idHeader + 'showHydrogens').attr('checked') == 'checked');
    if (!drawHydrogens) {
        var all_but_h = this.excludeElements(all, ["H"])
        all = all_but_h
    }

    //if ($(idHeader + 'biomt').attr('checked') && this.protein.biomtChains != "") all = this.getChain(all, this.protein.biomtChains);
    var allHet = this.getHetatms(all);
    var hetatm = this.removeSolvents(allHet);

    console.log("selection " + (+new Date() - time));
    time = new Date();

    this.colorByAtom(all, {});
    var colorMode = $(idHeader + 'color').val();
    if (colorMode == 'ss') {
        this.colorByStructure(all, 0xcc00cc, 0x00cccc);
    } else if (colorMode == 'atomtype') {
        this.colorByAtomElement(all, colorscheme)
    } else if (colorMode == 'chain') {
        this.colorByChain(all);
    } else if (colorMode == 'chainbow') {
        this.colorChainbow(all);
    } else if (colorMode == 'b') {
        this.colorByBFactor(all);
    } else if (colorMode == 'polarity') {
        this.colorByPolarity(all, 0xcc0000, 0xcccccc);
    }
    console.log("color " + (+new Date() - time));
    time = new Date();

    var asu = new THREE.Object3D();
    var mainchainMode = $(idHeader + 'mainchain').val();
    var doNotSmoothen = ($(idHeader + 'doNotSmoothen').attr('checked') == 'checked');
    if ($(idHeader + 'showMainchain').attr('checked')) {
        if (mainchainMode == 'ribbon') {
            this.drawCartoon(asu, all, doNotSmoothen);
            this.drawCartoonNucleicAcid(asu, all);
        } else if (mainchainMode == 'thickRibbon') {
            this.drawCartoon(asu, all, doNotSmoothen, this.thickness);
            this.drawCartoonNucleicAcid(asu, all, null, this.thickness);
        } else if (mainchainMode == 'strand') {
            this.drawStrand(asu, all, null, null, null, null, null, doNotSmoothen);
            this.drawStrandNucleicAcid(asu, all);
        } else if (mainchainMode == 'chain') {
            this.drawMainchainCurve(asu, all, this.curveWidth, 'CA', 1);
            this.drawMainchainCurve(asu, all, this.curveWidth, 'O3\'', 1);
        } else if (mainchainMode == 'cylinderHelix') {
            this.drawHelixAsCylinder(asu, all, 1.6);
            this.drawCartoonNucleicAcid(asu, all);
        } else if (mainchainMode == 'tube') {
            this.drawMainchainTube(asu, all, 'CA', 0.3);
            this.drawMainchainTube(asu, all, 'O3\'', 0.3); // FIXME: 5' end problem!
        } else if (mainchainMode == 'btube') {
            this.drawMainchainTube(asu, all, 'CA');
            this.drawMainchainTube(asu, all, 'O3\''); // FIXME: 5' end problem!
        } else if (mainchainMode == 'bonds') {
            this.drawBondsAsStick(asu, all, this.cylinderRadius, this.cylinderRadius, true);
        }
    }


    //   if ($(idHeader + 'line').attr('checked')) {
    //      this.drawBondsAsLine(this.modelGroup, this.getSidechains(all), this.lineWidth);
    //   }
    //   if ($(idHeader + 'sticks').attr('checked')) {
    //      this.drawBondsAsStick(this.modelGroup, this.getSidechains(all), this.lineWidth);
    //   }
    //   console.log("mainchain " + (+new Date() - time)); time = new Date();

    if ($(idHeader + 'showBases').attr('checked')) {
        var hetatmMode = $(idHeader + 'base').val();
        if (hetatmMode == 'nuclStick') {
            this.drawNucleicAcidStick(this.modelGroup, all);
        } else if (hetatmMode == 'nuclLine') {
            this.drawNucleicAcidLine(this.modelGroup, all);
        } else if (hetatmMode == 'nuclPolygon') {
            this.drawNucleicAcidLadder(this.modelGroup, all);
        }
    }

    var target = $(idHeader + 'symopHetatms').attr('checked') ? asu : this.modelGroup;
    if ($(idHeader + 'showNonBonded').attr('checked')) {
        var nonBonded = this.getNonbonded(allHet);
        var nbMode = $(idHeader + 'nb').val();
        if (nbMode == 'nb_sphere') {
            this.drawAtomsAsIcosahedron(target, nonBonded, 0.3, true);
        } else if (nbMode == 'nb_cross') {
            this.drawAsCross(target, nonBonded, 0.3, true);

        }
    }

    if ($(idHeader + 'showSidechains').attr('checked')) {
        var hetatmMode = $(idHeader + 'sidechain').val();
        if (hetatmMode == 'stick') {
            this.drawBondsAsStick(this.modelGroup, this.getSidechains(all), this.cylinderRadius, this.cylinderRadius, true);
        } else if (hetatmMode == 'sphere') {
            this.drawAtomsAsSphere(this.modelGroup, this.getSidechains(all), this.sphereRadius);
        } else if (hetatmMode == 'line') {
            this.drawBondsAsLine(this.modelGroup, this.getSidechains(all), this.curveWidth);
        } else if (hetatmMode == 'icosahedron') {
            this.drawAtomsAsIcosahedron(this.modelGroup, this.getSidechains(all), this.sphereRadius);
        } else if (hetatmMode == 'ballAndStick') {
            this.drawBondsAsStick(this.modelGroup, this.getSidechains(all), this.cylinderRadius / 1.5, this.cylinderRadius * 2, true, false, 0.3);
        } else if (hetatmMode == 'ballAndStick2') {
            this.drawBondsAsStick(this.modelGroup, this.getSidechains(all), this.cylinderRadius / 1.0, this.cylinderRadius * 2, true, true, 0.3);
        }

    }

    //this.drawAtomsAsSphere(this.modelGroup, this.getSelected(all), this.sphereRadius);

    if ($(idHeader + 'showHetatms').attr('checked')) {
        var hetatmMode = $(idHeader + 'hetatm').val();
        if (hetatmMode == 'stick') {
            this.drawBondsAsStick(target, hetatm, this.cylinderRadius, this.cylinderRadius, true);
        } else if (hetatmMode == 'sphere') {
            this.drawAtomsAsSphere(target, hetatm, this.sphereRadius);
        } else if (hetatmMode == 'line') {
            this.drawBondsAsLine(target, hetatm, this.curveWidth);
        } else if (hetatmMode == 'icosahedron') {
            this.drawAtomsAsIcosahedron(target, hetatm, this.sphereRadius);
        } else if (hetatmMode == 'ballAndStick') {
            this.drawBondsAsStick(target, hetatm, this.cylinderRadius / 2.0, this.cylinderRadius, true, false, 0.3);
        } else if (hetatmMode == 'ballAndStick2') {
            this.drawBondsAsStick(target, hetatm, this.cylinderRadius / 2.0, this.cylinderRadius, true, true, 0.3);
        }

    }
    console.log("hetatms " + (+new Date() - time));
    time = new Date();

    var projectionMode = $(idHeader + 'projection').val();
    if (projectionMode == 'perspective') this.camera = this.perspectiveCamera;
    else if (projectionMode == 'orthoscopic') this.camera = this.orthoscopicCamera;

    this.setBackground(parseInt($(idHeader + 'bgcolor').val()));

    if ($(idHeader + 'cell').attr('checked')) {
        this.drawUnitcell(this.modelGroup);
    }

    if ($(idHeader + 'biomt').attr('checked')) {
        this.drawSymmetryMates2(this.modelGroup, asu, this.protein.biomtMatrices);
    }
    if ($(idHeader + 'packing').attr('checked')) {
        this.drawSymmetryMatesWithTranslation2(this.modelGroup, asu, this.protein.symMat);
    }
    this.modelGroup.add(asu);
};

