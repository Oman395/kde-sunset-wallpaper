# kde-sunset-wallpaper
Very simple node.js script to set wallpaper dynamically. It fetches the start/end of civil twighlight, and uses this to generate a gradient which is cropped based on the local time. It then draws foreground.png on top of this; you can set it to whatever you want.

It probably shouldn't be node.js, but I'm only really good at node, and the canvas library is amazing

## Installation
1. Clone the repository to ~/bin/wpp. MAKE SURE THAT THIS PATH IS EXACT. I don't want to implement a system to figure out where I should be getting files from.
2. Choose your settings; these are all relatively self explanatory, and are in the config.json file.
3. Create a user systemd service:
 - Create ~/.config/systemd/user/[name].service
 - Put in your configuration (Here's mine)
 ```
 [Unit]
 Description=Script to change my wallpaper based on the time

 [Service]
 Type=simple
 ExecStart=/bin/node /home/oran/bin/wpp/index.js
 Restart=always
 RestartSec=10

 [Install]
 WantedBy=multi-user.target
 ```
 - Run "systemctl --user --now enable [name].service"
 - You should be all set! If the wallpaper changes, you've done everything correctly.
4. Enjoy!

## NOTE: THIS IS NOT SUPPORTED OUTSIDE KDE PLASMA. I HAVE NO IDEA HOW TO DO IT OUTSIDE OF KDE PLASMA, AND I DON'T PARTICULARLY CARE EITHER.
