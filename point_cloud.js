if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

var vertexShaderSource = `
    attribute float size;

    varying vec3 vColor;

    void main() {

        vColor = color;

        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

        gl_PointSize = size;

        gl_Position = projectionMatrix * mvPosition;

    }
`;

var fragmentShaderSource = `
    uniform sampler2D texture;

    varying vec3 vColor;

    void main() {

        gl_FragColor = vec4( vColor, 1.0 );

        //gl_FragColor = gl_FragColor;
        gl_FragColor = gl_FragColor * texture2D( texture, gl_PointCoord );

    }
`;

var particles = 8000;

//read ArrayBuffer into gl buffers
function loadBuffers(buffer) {
    var reader = new DataView(buffer);
    //get number of vertices and faces
    //var numVertices = reader.getUint32(0);
    var numVertices = particles
    point_cloud = new Float32Array(buffer,0,numVertices*3);
    return point_cloud
}

class PointCloudViewer {
    constructor(cfg) {
        this.cfg = cfg;
        this.setup_scene();
        this.init_particle_system();
    }

    load_model(model) {
        var parts = model.split("/");
        var url = "gallery/models/" + model + ".obj";
        console.log(url);

        var xhr = new XMLHttpRequest();
        self = this
     
        xhr.onreadystatechange = function () { 
            if (xhr.readyState == xhr.DONE) {
                if (xhr.status == 200 && xhr.response) {
                    var points = loadBuffers(xhr.response);
                    console.log(points[0], points[1], points[2])
                    self.set_geometry(points)
                    PointCloudViewer.animate(self)
                } else {
                    console.log("Failed to download:" + xhr.status + " " + xhr.statusText);
                }
            }
        } 
        // Open the request for the provided url 
        xhr.open("GET", url, true);
        // Set the responseType to 'arraybuffer' for ArrayBuffer response 
        xhr.responseType = "arraybuffer";    
        xhr.send();
    }

    viewport_params() {
        // returns width, height, aspect ratio
        //console.log("page width", window.innerWidth)
        var container = document.getElementById( this.cfg.container_id );
        var width = container.offsetWidth
        var max_size = 400;
        if(width > max_size)
            width = max_size;
        var height = width
        var aspect = width / height
        return [width, height, aspect]    
    }

    setup_scene() {
        cfg = this.cfg;

        var viewport = this.viewport_params()
        var width = viewport[0]
        var height = viewport[1]
        var aspect = viewport[2]

        this.camera = new THREE.PerspectiveCamera( 30, aspect, 1, 10000 );
        var camera = this.camera
        camera.position.set(0.75, 0, 2);
        camera.up = new THREE.Vector3(0,0,-1);
        camera.lookAt(new THREE.Vector3(0.,0,0));

        if (cfg.mouse_control)
        {
            var controls = new THREE.TrackballControls( camera );
            controls.rotateSpeed = 1.0;
            controls.zoomSpeed = 1.2;
            controls.panSpeed = 0.8;
            controls.noZoom = false;
            controls.noPan = true;
            controls.staticMoving = true;
            controls.dynamicDampingFactor = 0.3;
            controls.keys = [ 65, 83, 68 ];
            controls.addEventListener( 'change', () => this.render() );
            this.controls = controls;
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xffffff );

        this.renderer = new THREE.WebGLRenderer();
        var renderer = this.renderer
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( width, height );

        var container = document.getElementById( cfg.container_id );
        container.appendChild( renderer.domElement );

        if (cfg.stats) {
            this.stats = new Stats();
            container.appendChild( this.stats.dom );
        }

        window.addEventListener( 'resize', () => this.onWindowResize(), false );
    }

    getGeometry(points_buf) {
        var geometry = new THREE.BufferGeometry(); 

        var colors = [];
        var sizes = [];

        var color = new THREE.Color();
        var sc = 1.5

        for ( var i = 0; i < particles; i ++ ) {
            //color.setHSL( i / particles, 1.0, 0.5 );

            var x = points_buf[i*3+0]*sc;
            var y = points_buf[i*3+1]*sc;
            var z = points_buf[i*3+2]*sc;

            // colors
            if (true) {
                var vx = x + 0.5;
                var vy = y + 0.5;
                var vz = z + 0.5;
                color.setRGB( vx, vy, vz );
            } else {
                var vx = x + 0.5;
                color.setRGB( vx, 0, 0 );
            }

            colors.push( color.r, color.g, color.b );
            //colors.push( 0.8, 0.8, 0.8 );

            sizes.push( this.cfg.point_size );
        }

        geometry.addAttribute( 'position', new THREE.BufferAttribute( points_buf, 3 ) );
        geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
        geometry.addAttribute( 'size', new THREE.Float32BufferAttribute( sizes, 1 ).setDynamic( true ) );

        return geometry
    }

    init_particle_system() {
        this.uniforms = {
            texture:   { value: new THREE.TextureLoader().load( "disc.png" ) }
        };

        var shaderMaterial = new THREE.ShaderMaterial( {

            uniforms:       this.uniforms,
            vertexShader:   vertexShaderSource,
            fragmentShader: fragmentShaderSource,

            //blending:       THREE.AdditiveBlending,
            depthTest:      true,
            transparent:    false,
            vertexColors:   true

        });

        var material = new THREE.PointsMaterial({
            size: 0.02,
            color: 0x888888
        });

        this.geometry = new THREE.BufferGeometry();
        this.particleSystem = new THREE.Points( this.geometry, shaderMaterial );
        this.scene.add( this.particleSystem );
    }

    set_geometry(points_buf) {
        this.geometry = this.getGeometry(points_buf)
        this.particleSystem.geometry = this.geometry
    }

    onWindowResize() {
        var viewport = this.viewport_params()
        var width = viewport[0]
        var height = viewport[1]
        var aspect = viewport[2]

        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( width, height );
        if (this.cfg.mouse_control)
        {
            this.controls.handleResize();
        }
    }

    static animate(self) {
        requestAnimationFrame( () => PointCloudViewer.animate(self));
        if (self.cfg.mouse_control)
            self.controls.update();
        else
            self.render();
        if (self.cfg.stats) {
            self.stats.update();
        }
    }

    render() {
        if (!self.cfg.mouse_control)
        {
            var time = Date.now() * 0.05;
            this.particleSystem.rotation.x = 0.01 * time;
            this.geometry.attributes.size.needsUpdate = true;
        }
        this.renderer.render( this.scene, this.camera );
    }
}

cfg = {
    "point_size": 6,
    "container_id": "teaser-cloud",
    "mouse_control": false,
    "stats": false
}

//viewer = new PointCloudViewer(cfg)

function on_gallery_click(model) {
    gallery_viewer.load_model(model);
}

cfg2 = {
    "point_size": 6,
    "container_id": "gallery-viewer",
    "mouse_control": false,
    "stats": false
}

gallery_viewer = new PointCloudViewer(cfg2)


var template = $('#listitem-template').html();
Mustache.parse(template);   // optional, speeds up future uses

function load_models_from_list(synthset, models) {
    image_list = ""

    for (var i = 0; i < models.length; i++) {
        model = models[i];
        //Do something
        model_id = synthset + "/" + model
        var rendered = Mustache.render(template, {"model_full_id": model_id});
        image_list = image_list + rendered;
    }

    $("#gallery-container").html(image_list)

    // display initial model
    gallery_viewer.load_model(synthset + "/" + models[0]);
}

database = {}

function load_synthset(synthset) {
    if (!(synthset in database)) {
        $.getJSON(
            synthset + ".json",
            function (data) {
                database[synthset] = data;
                load_models_from_list(synthset, data);
            });        
    } else {
        load_models_from_list(synthset, database[synthset]);
    }
}

$("#class-toggle :input").change(function() {
    var synthset = $(this).attr("synthset");
    load_synthset(synthset);
});

$(document).ready(function() {
    // initialize with chair
    load_synthset("03001627");

    //$(".btn").first().button("toggle");
});
