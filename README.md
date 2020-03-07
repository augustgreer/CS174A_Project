# CS174A_Project
Final Project for CS174A (Cube Runner)

There are some spots I marked in the code with specific TODOs, but I am compiling a list here of what I can remember.

1. Collision Detection (player should lose when they hit obstacle)
2. Special Feature (Some kind of shading? Or maybe look into adding some sort of depth fading like in the real version where far away blocks fade into view as they get closer)
3. Make it look better
  a. Map a jpg texture to the background (maybe do a space background or something like that? Just like we did in HW4
  b. Add texture/color to the obstacles and player pieces
4. Delete obstacles that go off screen so they don't go on forever
5. We can also make the camera rotate on the z-axis a little when the player moves side to side like in the real version. This may not be a good idea if it makes the game play weird, but it might add an immersive feeling. If we do this, we should also rotate the player piece as it moves to match the camera.
6. Add a time-based scorecard. This should be easy since the variable "t" is already in the display() method.
