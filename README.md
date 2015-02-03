Rosetta Diagrams
=================

RosettaDiagrams is a framework for running Rosetta modeling jobs on the cloud via a web interface.
It contains RosettaDiagrams as one of its modeling tools, allowing users to create modeling trajectories by drawing a diagram.


How to use RosettaDiagrams?
----------------------------

To start a new job , simply click the button on the top left corner of the dashboard.

![dashboard](https://cloud.githubusercontent.com/assets/1312830/5439401/213ea3aa-8488-11e4-8ffa-6802832fa36c.png)

In the wizard that opens you'll enter the pdb you are going to model/design, choose a protocol/Rosetta Diagram/Enter a Rosetta Script

![wizard](https://cloud.githubusercontent.com/assets/1312830/5439526/1f7668ae-8489-11e4-84ac-99d38836b252.png)

Enter the number of jobs and submit to the cluster.
The section below the submit button contains all the simulation that were submitted by the user.
The gray badge describes the total number of jobs submitted, the green one - the number of jobs completed and the red one contains the number of jobs that were ended in error.


The section below shows results obtained from modeling simulation, ordered in a 2 dimensional plot, with axes that can be easily modified. In the example below, the axes are total score and irms:

![graph](https://cloud.githubusercontent.com/assets/1312830/5439581/902485fe-8489-11e4-9974-fc504ac4fb93.png)

Clicking on a point in the graph will load the respective structure and its energy table on the top right corner of the dashboard. Right clicking the structure brings up a context menu that is used to modify the view of the structure.

The Rosetta Diagrams section on the bottom right corner contains all the diagrams that were created by the user. 
To create a new diagram, click on the action button -> new diagram.

To add movers/filter , search for their name in the autocomplete text box, and then click the plus sign. (Task Operations will soon be added.)

To connect between them, click the **connection mode** checkbox on top, click one element, then the other. A line will be formed between them.
![diagrams](https://cloud.githubusercontent.com/assets/1312830/5439817/a3e3d9da-848b-11e4-94a8-e83da65c5778.png)

To change the attributes of each mover/filter - double click the element in the diagram:
![attributes](https://cloud.githubusercontent.com/assets/1312830/5439857/efc859a2-848b-11e4-8531-11d64f545b91.png)

and click the value of the attribute to modify it.



<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br /><span xmlns:dct="http://purl.org/dc/terms/" property="dct:title">Rosetta Diagrams</span> by <a xmlns:cc="http://creativecommons.org/ns#" href="http://www.rosettadiagrams.org" property="cc:attributionName" rel="cc:attributionURL">Lior Zimmerman</a> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.

