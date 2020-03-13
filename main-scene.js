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
            player: new Player(),
            subsphere: new Subdivision_Sphere(3) 
        }
        this.submit_shapes( context, shapes );
        this.context = context;
        this.materials = { 
            phong: context.get_instance(Phong_Shader).material( Color.of( 1,1,0,1 ) ),
            box: context.get_instance(Texture_Fade).material(Color.of(Math.random(), Math.random(), Math.random(), 1), {ambient: 0, diffusivity: 0.1, specularity: 1}),
            player: context.get_instance(Phong_Shader).material(Color.of(Math.random(), Math.random(), Math.random(), 1)),
            explosion: context.get_instance(Explode_Shader).material(Color.of(1,1,1,1), {ambient: 0.7, diffusivity: 0.2, specularity: 0.3})
        }
        this.lights = [ new Light( Vec.of( 0,2,20,1 ), Color.of( 1,1,1,1 ), 100000 ) ];
        this.initial_player_transform = Mat4.identity().times(Mat4.translation([0,1,0])).times(Mat4.rotation(Math.PI/2, Vec.of(-1, 0, 0)));
        this.initial_camera_transform = context.globals.graphics_state.camera_transform; 
        this.player_transform = this.initial_player_transform;
        this.obstacle_transforms = [];
        this.game_state = "START";
        this.state_strs = {"START"   : "Press either key to start.", //used to determine which menu text to draw, based on game state. 
                           "PLAYING" : "",
                           "DYING": "",
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
        this.explosion_scale = 0.1; 
    }
    change_colors() {
        this.materials.box = this.context.get_instance(Texture_Fade).material(Color.of(Math.random(), Math.random(), Math.random(), 1), {ambient: 0, diffusivity: 0.1, specularity: 1}),
        this.materials.player = this.context.get_instance(Phong_Shader).material(Color.of(Math.random(), Math.random(), Math.random(), 1));
    }
    add_obstacle() {
        let obstacle = Mat4.identity().times(Mat4.translation([(Math.random()*200-100)+this.player_transform[0][3], 1, -80]));
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
    manage_obstacles(graphics_state, t, dt, still) {
    	//add obstacle every other interval only when 5 seconds has passed after drawing the funnel
        if ((t > this.last_added +this.add_interval) && (t - this.game_started_time > 4 || this.game_state === "START")) { //allow 
            this.last_added = t;
            this.add_obstacle();
        }
        var invisible_obstacles = [];
        //draw obstacles
        for (var i = 0; i < this.obstacle_transforms.length; i++) {
            this.obstacle_transforms[i] = this.obstacle_transforms[i].times(Mat4.translation([0,0,24*(still*dt)]));
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
    draw_explosion(graphics_state, t, dt) {
       var ss = this.shapes.subsphere;
       var scale = this.explosion_scale; 
       ss.draw(graphics_state, this.player_transform.times(Mat4.scale([scale, scale, scale])), this.materials.explosion);
       this.explosion_scale = Math.min(scale*(1+20*dt), 7);
    }
    display_dying(graphics_state, t, dt) {
        this.manage_obstacles(graphics_state, t, dt, 0);
        if (graphics_state.start_time == -1) graphics_state.start_time = t;
        if (this.explosion_scale < 7) this.draw_explosion(graphics_state, t, dt);
        else {
            graphics_state.start_time = -1;
            this.game_state = "DEAD";
            this.player_transform = this.initial_player_transform;
            return; 
        }
    }
    display_idle(graphics_state, t, dt) {
        var still; 
        if (this.game_state != "DEAD") still = 1;
        this.manage_obstacles(graphics_state, t, dt, still);
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
        this.manage_obstacles(graphics_state, t, dt, 1);
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
            this.player_spd = 0.;  
            this.score = 0;
            this.explosion_scale = 0.1;
            this.game_state = "DYING";
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
        switch(this.game_state) {
            case "PLAYING": this.display_playing(graphics_state, t, dt); break;
            case "DYING": this.display_dying(graphics_state, t, dt); break; 
            default: this.display_idle(graphics_state, t, dt); break; 
        }
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
          gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}
class Explode_Shader extends Phong_Shader
{ fragment_glsl_code()           // ********* FRAGMENT SHADER ********* 
    {
      return `
        uniform sampler2D texture;
        uniform float start_time; 
        void main()
        { if( GOURAUD || COLOR_NORMALS )    // Do smooth "Phong" shading unless options like "Gouraud mode" are wanted instead.
          { gl_FragColor = VERTEX_COLOR;    // Otherwise, we already have final colors to smear (interpolate) across vertices.            
            return;
          }                                 // If we get this far, calculate Smooth "Phong" Shading as opposed to Gouraud Shading.
                                            // Phong shading is not to be confused with the Phong Reflection Model.
          vec4 tex_color = texture2D( texture, f_tex_coord );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          
          float time = (animation_time - start_time);
          float redshift = 0.0;                                               
          gl_FragColor = vec4(shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );
          if (gl_FragColor[1] <= 0.5 && gl_FragColor[2] <= 0.5) redshift = 4.1*time;
          gl_FragColor.xyz += vec3(-redshift, -2.0*time, -2.9*time);
          
        }`;
    }

    update_GPU( g_state, model_transform, material, gpu = this.g_addrs, gl = this.gl )
    {                              // First, send the matrices to the GPU, additionally cache-ing some products of them we know we'll need:
      this.update_matrices( g_state, model_transform, gpu, gl );
      gl.uniform1f ( gpu.animation_time_loc, g_state.animation_time / 1000 );
      gl.uniform1f ( gpu.start_time_loc, g_state.start_time);

      if( g_state.gouraud === undefined ) { g_state.gouraud = g_state.color_normals = false; }    // Keep the flags seen by the shader 
      gl.uniform1i( gpu.GOURAUD_loc,        g_state.gouraud || material.gouraud );                // program up-to-date and make sure 
      gl.uniform1i( gpu.COLOR_NORMALS_loc,  g_state.color_normals );                              // they are declared.

      gl.uniform4fv( gpu.shapeColor_loc,     material.color       );    // Send the desired shape-wide material qualities 
      gl.uniform1f ( gpu.ambient_loc,        material.ambient     );    // to the graphics card, where they will tweak the
      gl.uniform1f ( gpu.diffusivity_loc,    material.diffusivity );    // Phong lighting formula.
      gl.uniform1f ( gpu.specularity_loc,    material.specularity );
      gl.uniform1f ( gpu.smoothness_loc,     material.smoothness  );

      if( material.texture )                           // NOTE: To signal not to draw a texture, omit the texture parameter from Materials.
      { gpu.shader_attributes["tex_coord"].enabled = true;
        gl.uniform1f ( gpu.USE_TEXTURE_loc, 1 );
        gl.bindTexture( gl.TEXTURE_2D, material.texture.id );
      }
      else  { gl.uniform1f ( gpu.USE_TEXTURE_loc, 0 );   gpu.shader_attributes["tex_coord"].enabled = false; }

      if( !g_state.lights.length )  return;
      var lightPositions_flattened = [], lightColors_flattened = [], lightAttenuations_flattened = [];
      for( var i = 0; i < 4 * g_state.lights.length; i++ )
        { lightPositions_flattened                  .push( g_state.lights[ Math.floor(i/4) ].position[i%4] );
          lightColors_flattened                     .push( g_state.lights[ Math.floor(i/4) ].color[i%4] );
          lightAttenuations_flattened[ Math.floor(i/4) ] = g_state.lights[ Math.floor(i/4) ].attenuation;
        }
      gl.uniform4fv( gpu.lightPosition_loc,       lightPositions_flattened );
      gl.uniform4fv( gpu.lightColor_loc,          lightColors_flattened );
      gl.uniform1fv( gpu.attenuation_factor_loc,  lightAttenuations_flattened );
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