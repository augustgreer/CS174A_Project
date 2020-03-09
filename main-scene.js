window.Cube_Runner = window.classes.Cube_Runner =
class Cube_Runner extends Scene_Component { 
    constructor( context, control_box ) { 
        super(   context, control_box );    
        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0,8,7 ), Vec.of( 0,1,-6 ), Vec.of( 0,0,-1 ) );
        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective(Math.PI/4, r, .1, 1000 );
        const shapes = { 
            box:   new Cube(), 
            axis:  new Axis_Arrows(),
            player: new Player()
        }
        this.submit_shapes( context, shapes );
        this.context = context;
        this.materials = { 
            phong: context.get_instance(Phong_Shader).material( Color.of( 1,1,0,1 ) ),
            box: context.get_instance(Texture_Fade).material(Color.of(Math.random(), Math.random(), Math.random(), 1), {ambient: 0, diffusivity: 0.1, specularity: 1}),
            player: context.get_instance(Phong_Shader).material(Color.of(Math.random(), Math.random(), Math.random(), 1))
        }
        this.lights = [ new Light( Vec.of( 0,2,20,1 ), Color.of( 1,1,1,1 ), 100000 ) ];
        this.initial_player_transform = Mat4.identity().times(Mat4.translation([0,1,0])).times(Mat4.rotation(Math.PI/2, Vec.of(-1, 0, 0)));
        this.initial_camera_transform = context.globals.graphics_state.camera_transform; 
        this.player_transform = this.initial_player_transform;
        this.obstacle_transforms = [];
        this.game_state = "START";
        this.state_strs = {"START"   : "Press either key to start.", //used to determine which menu text to draw, based on game state. 
                           "PLAYING" : "", 
                           "DEAD" : "You died! Press either key to start again."}; 
        this.last_added = 0; //time (seconds in float) when the last obstacle was added
        this.add_interval = 0.1; //how frequently an obstacle should be added
        this.player_accel = 0.0133; //player's turning acceleration
        this.friction = 0.0203; //friction between floor and player
        this.player_max_spd = 0.43; //player's max turning speed
        this.player_spd = 0.; //player's current turning speed 
        this.dir = 0; //Two bits representing key state.
        this.input_lock = false;  
        this.highest = 0;
        this.score = 0;
        this.camera_lag = 0.6;
        this.game_started = false;
        this.game_started_time = 0; 
    }
    change_colors() {
        this.materials.box = this.context.get_instance(Texture_Fade).material(Color.of(Math.random(), Math.random(), Math.random(), 1), {ambient: 0, diffusivity: 0.1, specularity: 1}),
        this.materials.player = this.context.get_instance(Phong_Shader).material(Color.of(Math.random(), Math.random(), Math.random(), 1));
    }
    add_obstacle() {
        let obstacle = Mat4.identity().times(Mat4.translation([(Math.random()*200-100)+this.player_transform[0][3], 1, -60]));
        this.obstacle_transforms.push(obstacle);
    }
    make_control_panel() { 
        this.key_triggered_button("Move Left", [";"], () =>  {this.dir |= 2;}, undefined, () => {this.dir &= (~2);});
        this.key_triggered_button("Move Right", ["'"], () => {this.dir |= 1;}, undefined, () => {this.dir &= (~1);});
        this.new_line(); this.new_line(); 
        this.live_string(box => {box.textContent = "Current score: " + this.score.toFixed(0)}); this.new_line(); 
        this.live_string(box => {box.textContent = "Highest score: " + Math.max(this.highest, this.score).toFixed(0)});
        this.new_line(); this.new_line(); 
        this.live_string(box => {box.textContent = this.state_strs[this.game_state]});  
    }
    ramp(initial, target, rate) { //used for acceleration 
        if (target > initial) return Math.min(initial + rate, target);
        else return Math.max(initial - rate, target);
    }
    lerp(a, b, r) { //used for camera lag effect
    	var result = a + (b-a)*r;
    	if (Math.abs(b - result) < 0.0001) result = b; 
    	return result;
    }
    detect_collision(new_speed) {
        var p_x = this.player_transform[0][3] + new_speed,
            p_y = this.player_transform[1][3],
            p_z = this.player_transform[2][3];
        var p_depth = 3.2; 
        var p_width = 0.9, p_height = 1.; //bounding volume slightly smaller than actual player object
        for (var i = 0; i < this.obstacle_transforms.length; i++) {
             var o_x = this.obstacle_transforms[i][0][3], 
                 o_y = this.obstacle_transforms[i][1][3],
                 o_z = this.obstacle_transforms[i][2][3], 
                 x_overlaps = (p_x + p_width  >= o_x - 1. && p_x <= o_x) || (p_x - p_width <= o_x + 1. && p_x >= o_x), 
                 y_overlaps = (p_y + p_height >= o_y - 1. && p_y <= o_y) || (p_y - p_height <= o_y + 1. && p_y >= o_y),
                 z_overlaps = (p_z  >= o_z - 1. && p_z <= o_z) || (p_z - p_depth <= o_z + 1. && p_z >= o_z); 
                 if (x_overlaps && y_overlaps && z_overlaps) return 1;
        }
        return 0;
    }
    manage_obstacles(graphics_state, t, dt) {
    	//add obstacle every other interval only when 5 seconds has passed after drawing the funnel
        if ((t > this.last_added +this.add_interval) && (t - this.game_started_time > 4 || this.game_state === "START")) { //allow 
            this.last_added = t;
            this.add_obstacle();
        }
        var invisible_obstacles = [];
        //draw obstacles
        for (var i = 0; i < this.obstacle_transforms.length; i++) {
            this.obstacle_transforms[i] = this.obstacle_transforms[i].times(Mat4.translation([0,0,24*dt]));
            this.shapes.box.draw(graphics_state, this.obstacle_transforms[i], this.materials.box);
            if (this.obstacle_transforms[i][2][3] >= 7) invisible_obstacles.push(i); 
        }
        //remove invisible obstacles 
        for (var i = 0; i < invisible_obstacles.length; i++) this.obstacle_transforms.splice(invisible_obstacles[i], 1);
    }
    draw_funnel() {
        for (var i = 0; i < 60; i++) {
            let obstacle = Mat4.identity().times(Mat4.translation([this.player_transform[0][3]+62-i, 1, -35-i]));
            this.obstacle_transforms.push(obstacle);
        }
        for (var i = 0; i < 60; i++) {
            let obstacle = Mat4.identity().times(Mat4.translation([this.player_transform[0][3]-62+i, 1, -35-i]));
            this.obstacle_transforms.push(obstacle);
        }
    }
    display_idle(graphics_state, t, dt) {
        this.manage_obstacles(graphics_state, t, dt);
        //update state 
        if (!this.input_lock && this.dir != 0) {
        	this.game_state = "PLAYING";
        	this.game_started = true;
        	this.game_started_time = t;
        	this.invisible_obstacles = [];
        	graphics_state.camera_transform = this.initial_camera_transform; 
        }
    }
    display_playing(graphics_state, t, dt) {
        if (this.game_started) {
            this.obstacle_transforms = [];
            this.draw_funnel();
            this.game_started = false;
        } 
        this.manage_obstacles(graphics_state, t, dt);
        //draw player and obstacles 
        this.shapes.player.draw(graphics_state, this.player_transform, this.materials.player);
        
		//update score 
		this.score += dt*1000;
		//update physics  
        var rate = this.dir ? this.player_accel : this.friction;
        var new_spd = this.ramp(this.player_spd, ((this.dir == 1) - (this.dir == 2))*this.player_max_spd, rate); 
        //detect collisions
        if (this.detect_collision(new_spd)) {
            if (this.highest < this.score) this.highest = this.score;
            //update state and reset score/colors/player transformation matrix
            this.player_transform = this.initial_player_transform;
            this.player_spd = 0.;  
            this.score = 0;
            this.game_state = "DEAD";
            this.change_colors(); 
            return;  
        }
        //if no collisions, move the player. 
        this.player_spd = new_spd;
        var camera_intermediate = this.player_transform[0][3];  
        this.player_transform = this.player_transform.times(Mat4.translation([this.player_spd,0,0]));
        camera_intermediate = this.lerp(camera_intermediate, this.player_transform[0][3], this.camera_lag);
        graphics_state.camera_transform = Mat4.look_at( Vec.of(camera_intermediate,8,7), Vec.of(camera_intermediate,1,-6), Vec.of( 0,0,-1));
        graphics_state.lights[0].position = Vec.of(this.player_transform[0][3],5,5,1);

        //Update spawn interval about every 5 seconds to increase difficulty with time
        if (t % 5 < 0.09 && this.add_interval > 0.016) {
            this.add_interval -= 0.001
        }
    }
    display( graphics_state ) {
    	graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;
        this.game_state == "PLAYING" ? this.display_playing(graphics_state, t, dt) : this.display_idle(graphics_state, t, dt);
        this.input_lock = (this.dir != 0); 
      }
  }

class Texture_Fade extends Phong_Shader
{ fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {
      return `
        uniform sampler2D texture;
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec4 tex_color = texture2D( texture, f_tex_coord );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}

window.Player = window.classes.Player = class Player extends Shape
{ constructor()  
    { super( "positions", "normals", "texture_coords" );
       var custom_shape_transform = Mat4.identity().times(Mat4.scale([1,0.1,1]));
       for (var i = 1; i <= 16; i++) {
           custom_shape_transform = custom_shape_transform.times(Mat4.scale([0.9, 1, 0.9])).times(Mat4.translation([0, 2, 0]));
           Cube.insert_transformed_copy_into( this, ["positions", "normals", "texture_coords"], custom_shape_transform );
       } 
    }
}