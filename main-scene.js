window.Assignment_Four_Scene = window.classes.Assignment_Four_Scene =
class Assignment_Four_Scene extends Scene_Component
  { constructor( context, control_box )     // The scene begins by requesting the camera, shapes, and materials it will need.
      { super(   context, control_box );    // First, include a secondary Scene that provides movement controls:
        if( !context.globals.has_controls   ) 
          context.register_scene_component( new Movement_Controls( context, control_box.parentElement.insertCell() ) ); 

        context.globals.graphics_state.camera_transform = Mat4.look_at( Vec.of( 0,8,7 ), Vec.of( 0,1,-6 ), Vec.of( 0,0,-1 ) );

        const r = context.width/context.height;
        context.globals.graphics_state.projection_transform = Mat4.perspective( Math.PI/4, r, .1, 1000 );

        const shapes = { box:   new Cube(), //obstacles
                         axis:  new Axis_Arrows(),
                         player: new Player()
                         //ball: new Shape_From_File("assets/football_ball_OBJ.obj"),
                         //ball: new Shape_From_File("/assets/football_ball_OBJ.obj")
                       }
        this.submit_shapes( context, shapes );

        this.materials =
          { phong: context.get_instance( Phong_Shader ).material( Color.of( 1,1,0,1 ) ),
            box: context.get_instance(Texture_Rotate).material(Color.of(1,0,0,1),{ambient:1}), //nearest
            player: context.get_instance(Phong_Shader).material(Color.of(1,0,0,1))
          }

        this.lights = [ new Light( Vec.of( -5,5,5,1 ), Color.of( 0,1,1,1 ), 100000 ) ];

        this.box_transform = Mat4.identity().times(Mat4.translation([45,1,-60]));
        this.player_transform = Mat4.identity().times(Mat4.translation([0,1,0])).times(Mat4.rotation(-Math.PI/2,[1,0,0]));
        this.obstacle_transforms = [];
        this.started = false; //true when player starts the game
        this.last_added = 0; //time (seconds in float) when the last obstacle was added
        this.add_interval = 0.5; //how frequently an obstacle should be added TODO: can be modified during run time possible based on difficulty?
        this.player_move_jump = 0.5; //controls how far one keyboard press moves the player side to side
        this.move_left = false;
        this.move_right = false;


      }

    add_obstacle() {
        let obstacle = Mat4.identity().times(Mat4.translation([Math.random()*90-55, 1, -60]));
        this.obstacle_transforms.push(obstacle)
    }

    //TODO: add a "delete_obstacle()"" method for when an obstacle goes off screen. As of right now, they continue forever.

    make_control_panel()
      { 
        this.key_triggered_button("Move Left", [";"], () => {
                this.move_left = true;
            });
        this.key_triggered_button("Move Right", ["'"], () => {
                this.move_right = true;
            });
        this.new_line();
      }

    display( graphics_state )
      { graphics_state.lights = this.lights;        // Use the lights stored in this.lights.
        const t = graphics_state.animation_time / 1000, dt = graphics_state.animation_delta_time / 1000;
        //this.shapes.axis.draw( graphics_state, Mat4.identity(), this.materials.phong );
        this.box_transform = this.box_transform.times(Mat4.translation([0,0,4*dt])); //20 rpm
        this.shapes.box.draw(graphics_state, this.box_transform, this.materials.box);

        //this.player_transform = this.player_transform.times(Mat4.rotation(2*Math.PI*(1/30)*dt,[0,1,0]));
        this.shapes.player.draw(graphics_state, this.player_transform, this.materials.player);

        if (t > this.last_added +this.add_interval) { //add obstacle every other second
            this.last_added = t;
            this.add_obstacle();
        }
        for (var i = 0; i < this.obstacle_transforms.length; i++) {
            this.obstacle_transforms[i] = this.obstacle_transforms[i].times(Mat4.translation([0,0,4*dt]));
            this.shapes.box.draw(graphics_state, this.obstacle_transforms[i], this.materials.box);
        }
        if (this.move_left) {
            this.player_transform = this.player_transform.times(Mat4.translation([-this.player_move_jump,0,0]));
            graphics_state.camera_transform = Mat4.look_at( Vec.of( this.player_transform[0][3],8,7 ), Vec.of( this.player_transform[0][3],1,-6 ), Vec.of( 0,0,-1 ) );//graphics_state.camera_transform.times(Mat4.translation([-this.player_transform[0][3], 0, 0]));
            //graphics_state.camera_transform = graphics_state.camera_transform.times(Mat4.translation([-this.player_transform[0][3], 0, 0]));//Mat4.look_at( Vec.of( 0,(8-10/*+this.player_transform[0][3]*/),7 ), Vec.of( 0,1,-6 ), Vec.of( 0,0,-1 ) );
            this.move_left = false;
        }
        if (this.move_right) {
            this.player_transform = this.player_transform.times(Mat4.translation([this.player_move_jump,0,0]));
            graphics_state.camera_transform = Mat4.look_at( Vec.of( this.player_transform[0][3],8,7 ), Vec.of( this.player_transform[0][3],1,-6 ), Vec.of( 0,0,-1 ) );//graphics_state.camera_transform.times(Mat4.translation([-this.player_transform[0][3], 0, 0]));
            this.move_right = false;
        }
      }
  }

class Texture_Scroll_X extends Phong_Shader
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
          vec4 tex_color = texture2D( texture, vec2(f_tex_coord.x-(2.0 * mod(animation_time, 4.0)), f_tex_coord.y) );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`;
    }
}

class Texture_Rotate extends Phong_Shader
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
          //The trigonometry used below was inspired by the post here: https://academo.org/demos/rotation-about-point/
          float pi = 3.14159265;
          float ang = 2.0*pi*mod((animation_time*(15.0/60.0)), 4.0); //2*Pi*(15 rpm)
          mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
          vec4 tex_color = texture2D( texture, rot*(f_tex_coord.xy-0.5)+0.5 );                         // Sample the texture image in the correct place.
                                                                                      // Compute an initial (ambient) color:
          if( USE_TEXTURE ) gl_FragColor = vec4( ( tex_color.xyz + shapeColor.xyz ) * ambient, shapeColor.w * tex_color.w ); 
          else gl_FragColor = vec4( shapeColor.xyz * ambient, shapeColor.w );
          gl_FragColor.xyz += phong_model_lights( N );                     // Compute the final color with contributions from lights.
        }`
    }
}

window.Player = window.classes.Player = class Player extends Shape
{ constructor()  
    { super( "positions", "normals", "texture_coords" );
       var custom_shape_transform = Mat4.identity().times(Mat4.scale([1,0.1,1]));
       for (var i = 1; i <= 16; i++) {
           custom_shape_transform = custom_shape_transform.times(Mat4.scale([0.9, 1, 0.9])).times(Mat4.translation([0, 2, 0]));
           Cube.insert_transformed_copy_into( this, ["positions", "normals", "texture_coords"], custom_shape_transform );
           /*custom_shape_transform = custom_shape_transform.times(Mat4.translation([0, -4*(i), 0]));
           Cube.insert_transformed_copy_into( this, ["positions", "normals", "texture_coords"], custom_shape_transform );
           custom_shape_transform = custom_shape_transform.times(Mat4.translation([0, 4*(i), 0]));*/
       } 
    }
}