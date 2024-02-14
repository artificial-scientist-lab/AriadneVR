/*Class: controlpanel-component

   attached to a plane-entity. Turns th eplane into a control panel for the UI to allow interactivity through virtual buttons.
   controls the active graphs, graph saving, renaming, removing and topoligy mode interactions.

   Listeners:
   		graphbuilt - (on document) onGraphBuilt:
		selectGraph - (on self) toggleGraph:
		saveTo - (on self) saveInitiated:
		removeGraph - (on self) removeGraph:
		newGraph - (on self) spawnNewGraph:
		rename - (on self) renameInitiated:
		topMode - (on self) switchTopMode:
		genConfFile - (on self) confFileInitiated:

	Events:
		topologyModeEnabled -
		topologyModeDisabled -
		graphactive -
		graphinactive -
		graphbuilt -

*/
AFRAME.registerComponent("controlpanel", {
	schema: {},

	/*Property: Attributes
		this.activeGraph - the currently active graph
		this.buttons - the buttons spawned by the panel
		this.graphs - the graphs spawned by the panel
		this.rowIndex - the index of the current row of buttons
		this.columnIndex - the index of the current column of buttons
		this.newGraphCounter - the number of new graphs spawned
		this.template - container the template for the config file
	*/

	//Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component. Sets the listeners and spawns the initial buttons.
	*/

	init: function () {
		this.el.setAttribute("id", "control-panel");

		document.addEventListener("graphbuilt", this.events.onGraphBuilt);
		this.el.addEventListener("selectGraph", this.events.toggleGraph);
		this.el.addEventListener("saveTo", this.events.saveInitiated);
		this.el.addEventListener("removeGraph", this.events.removeGraph);
		this.el.addEventListener("newGraph", this.events.spawnNewGraph);
		this.el.addEventListener("rename", this.events.renameInitiated);
		this.el.addEventListener("topMode", this.events.switchTopMode);
		this.el.addEventListener("genConfFile", this.events.confFileInitiated);

		textEl = document.createElement("a-entity");
		textEl.setAttribute("text", {
			width: 0.5,
			color: "black",
			anchor: "left",
			align: "left",
			value: "ACTIVE GRAPHS:",
		});

		textEl.setAttribute("position", { x: -0.45, y: 0.22, z: 0 });

		spawnBlockButton(
			"newGraph",
			"#EF8354",
			[-0.42, -0.18, 0],
			[0.05, 0.05, 0.01],
			(parent = this.el)
		);
		spawnBlockButton(
			"topMode",
			"#EF8354",
			[-0.35, -0.18, 0],
			[0.05, 0.05, 0.01],
			(parent = this.el),
			(text_color = "#5f5f5f")
		);
		this.el.appendChild(textEl);
		this.rowIndex = 0;
		this.columnIndex = 0;
		this.buttons = [];
		this.graphs = [];
		this.newGraphCounter = 0;
	},

	//Group: event-handlers
	// ----------------------------------------------

	events: {
		/*Function:switchTopMode
			Called when the topology mode button is pressed.
			Emits the topologyModeEnabled or topologyModeDisabled event depending on the state of the button.

			Parameters:
				event - the event object deliverd by the button
		*/
		switchTopMode: function (event) {
			switch (event.detail.pushed) {
				case true:
					this.el.emit("topologyModeEnabled");
					break;
				case false:
					this.el.emit("topologyModeDisabled");
					break;
			}
		},

		/*Function:renameInitiated
			Called when the rename button is pressed.
			Spawns a keyboard and sets the panel up to listen to the superkeyboardinput event to rename the graph.

			Parameters:
				event - the event object deliverd by the button
		*/
		renameInitiated: function (event) {
			this.spawnKeyboard(
				(value = this.activeGraph.data.name),
				(label = "Enter new graph name")
			);
			this.el.addEventListener("superkeyboardinput", this.events.renameGraph);
		},

		/*Function:renameGraph
			Called when the superkeyboardinput event is fired.
			Renames the graph and updates the button and dataslate accordingly.

			Parameters:
				event - the event object deliverd by the superkeyboard
		*/
		renameGraph: function (event) {
			//const oldName = this.activeGraph.data.name;
			//const button = document.querySelector(
			//	`#button-${oldName}`
			//);
			//const dataslate = document.querySelector(
			//	`#data-slate-${oldName}`
			//);
			//
			//button.setAttribute("text", {
			//	value: event.detail.value,
			//});
			//
			//button.setAttribute("id", "button-" + event.detail.value);
			//dataslate.setAttribute(
			//	"id",
			//	"data-slate-" + event.detail.value
			//);
			this.activeGraph.data.name = event.detail.value;
			this.activeGraph.update(this.activeGraph.oldData); //manually called since no .setAttribute call to trigger update
			this.el.removeEventListener(
				"superkeyboardinput",
				this.events.renameGraph
			);
		},

		/*Function:saveInitiated
			Called when the save button is pressed.
			Spawns a keyboard and sets the panel up to listen to the superkeyboardinput event to save the graph.

			Parameters:
				event - the event object deliverd by the button
		*/
		saveInitiated: function (event) {
			this.spawnKeyboard(
				(value = this.activeGraph.data.name),
				(label =
					"Enter filename then press enter to save, graph name is adjusted automatically")
			);
			this.el.addEventListener("superkeyboardinput", this.events.saveToDevice);
		},

		/*Function:saveToDevice
			Called when the superkeyboardinput event is fired.
			Saves the graph data to the device as JSON.

			Parameters:
				event - the event object deliverd by the superkeyboard
		*/
		saveToDevice: function (event) {
			this.activeGraph.data.name = event.detail.value;
			this.activeGraph.update(this.activeGraph.oldData); //manually called since no .setAttribute call to trigger update
			this.activeGraph.save();
			this.el.removeEventListener(
				"superkeyboardinput",
				this.events.saveToDevice
			);
		},

		/*Function:confFileInitiated
			Called when the generate config file button is pressed.
			Spawns a keyboard and sets the panel up to listen to the superkeyboardinput event to generate the config file.

			Parameters:
				event - the event object deliverd by the button
		*/
		confFileInitiated: function (event) {
			this.template = JSON.parse(JSON.stringify(configTemplate)); //deep copy of globally available template defined at the top of the graph.js script
			this.spawnKeyboard(
				(value = ""),
				(label = "Enter Task Description"),
				(multiple = false)
			);
			this.el.addEventListener("superkeyboardinput", this.events.saveTemplate);
		},

		/*Function: saveTemplate
		Saves the config file template to the device as JSON.
		*/
		saveTemplate: function (event) {
			let miniTemplate = buildEntries4Config(this.activeGraph.graphData);
			this.template.description = event.detail.value;

			if (miniTemplate.init_graph.length != 0) {
				this.template.init_graph = miniTemplate.init_graph.map((connection) => {
					if (connection[1] > connection[0]) {
						return connection; //node order is already correct
					} else {
						return [connection[1], connection[0], connection[3], connection[2]]; //swap node order
					}
				});
			}

			if (miniTemplate.removed_connections.length != 0) {
				this.template.removed_connections =
					miniTemplate.removed_connections.map(
						(connection) => connection.sort((a, b) => a - b) //pyTheus needs connections to be sorted in ascending order by node index
					);
			}

			if (miniTemplate.nodes2connect.length != 0) {
				this.template.nodes2connect = miniTemplate.nodes2connect.map(
					(connection) => connection.sort((a, b) => a - b) //pyTheus needs connections to be sorted in ascending order by node index
				);
			}

			this.template = JSON.stringify(this.template);
			console.log(this.template);
			download(
				this.template,
				this.activeGraph.data.name + "_searchTemplate" + ".json",
				"text/plain"
			);
			this.el.removeEventListener("superkeyboardinput", this.events.saveTemplate)
		},

		/*Function:spawnNewGraph
			Called when the new graph button is pressed.
			Spawns a new graph 
		*/
		spawnNewGraph: function () {
			this.newGraphCounter += 1;
			graphName = "newGraph" + String(this.newGraphCounter);

			const g = document.createElement("a-entity");
			g.setAttribute("id", `graph-${graphName}`);
			g.setAttribute("graph", {
				name: graphName,
				graphData: JSON.stringify({
					graph: {
						vertices: [
							{
								id: 0,
								position: [0.0, 0.02, 0.0],
								geometry: "sphere",
								edges: [],
								neighbours: [],
							},
						],
						edges: [],
						target_state: [],
						amplitudes: [],
					},
				}),
			});

			g.setAttribute("grabbable", {
				startButtons: "gripdown",
				endButtons: "gripup",
			});
			this.el.sceneEl.appendChild(g);
			g.setAttribute("position", { x: 0, y: 1.2, z: -0.5 });
		},

		/*Function:removeGraph
			Called when the remove graph button is pressed.
			Removes the active graph.
		*/
		removeGraph: function () {
			if (this.columnIndex == 0 && this.rowIndex != 0) {
				this.rowIndex -= 1;
				this.columnIndex = 4; //there are 0-4 graph indeces per row
			} else {
				this.columnIndex -= 1;
			}
			const button = document.querySelector(
				`#button-${this.activeGraph.data.name}`
			);

			button.components.button.feedbackClick();

			this.shiftButton(
				this.activeGraph.el,
				button.object3D.position.toArray(),
				this.graphs.slice(this.graphs.indexOf(this.activeGraph.el))
			);

			const slate = document.querySelector(
				`#data-slate-${this.activeGraph.data.name}`
			);
			this.el.sceneEl.removeChild(slate);
			slate.destroy();

			this.el.removeChild(button);
			button.destroy();

			this.graphs = this.graphs.filter((graph) => graph != this.activeGraph.el);
			this.el.sceneEl.removeChild(this.activeGraph.el);

			this.setGraphInactive();
		},

		/*Function:onGraphBuilt
			Called when a graph is built.
			Spawns a button for the graph and adds the graph to the list of graphs.
			Updates the row and column index to keep track of the button positions.

			Parameters:
				event - the event object deliverd by the graph
		*/
		onGraphBuilt: function (event) {
			let button = spawnBlockButton(
				"selectGraph",
				"#2D3142",
				[-0.4 + this.columnIndex * 0.16, 0.19 - this.rowIndex * 0.04, 0],
				[0.15, 0.02, 0.01],
				(parent = this.el),
				(text_color = "white"),
				(label = event.detail.graph.components.graph.data.name)
			);

			button.setAttribute(
				"id",
				"button-" + event.detail.graph.components.graph.data.name
			);
			this.columnIndex += 1;
			if (this.columnIndex == 5) {
				//as the index gets added before this 5 means 5 graphs spawned with the positional index of the last being 4
				this.rowIndex += 1;
				this.columnIndex = 0;
			}
			this.graphs.push(event.detail.graph);
		},

		/*Function:toggleGraph
			Called when a graph button is pressed.
			Activates the corresponding graph and deactivates the previously active graph.

			Parameters:
				event - the event object deliverd by the button
		*/
		toggleGraph: function (event) {
			if (event.detail.pushed) {
				if (this.activeGraph != null) {
					const button = document.querySelector(
						`#button-${this.activeGraph.data.name}`
					);
					button.components.button.feedbackClick();
					this.setGraphInactive();
				}
				this.setGraphActive(event);
			} else {
				this.setGraphInactive(event);
			}
		},
	},

	//Group: methods
	// ----------------------------------------------

	/*Method: spawnKeyboard
		Spawns a superkeyboard entity and sets it up to be used for the given purpose.

		Parameters:
			value - the initial value of the keyboard
			label - the label of the keyboard
			multiple - flag deciding whether the keyboard should accept multiple inputs or not
	*/
	spawnKeyboard: function (value, label, multiple = false) {
		console.log("spawning keyboard");
		let keyboard = this.el.querySelector("#keyboard");

		if (keyboard == undefined) {
			keyboard = document.createElement("a-entity");
			keyboard.object3D.position.set(0, 0.5, 0.1);
			keyboard.object3D.rotation.set(Math.PI / 4, 0, 0);
			this.el.appendChild(keyboard);
			keyboard.setAttribute("id", "keyboard");
		}
		keyboard.setAttribute("super-keyboard", {
			show: true,
			align: "center",
			value: value,
			label: label,
			inputColor: "#EF8354",
			keyBgColor: "#EF8354",
			keyHoverColor: "#2D3142",
			keyPressColor: "#2A6564",
			keyColor: "#EA5C1F",
			hand: "#rightHandCollider",
			imagePath: "assets/",
			filters: ["trim"],
			multipleInputs: multiple,
		});
		keyboard.object3D.visible = true;
	},

	/*Method: setGraphActive
		Activates the given graph and spawns the corresponding buttons and dataslate.
		Called by the toggleGraph event handler when a graph button is pressed.

		Parameters:
			event - the event object deliverd by the button passed on by the handler
	*/
	setGraphActive: function (event) {
		button = document.querySelector(`#${event.detail.name}`);
		graph = document.querySelector(`#graph-${event.detail.name.slice(7)}`)
			.components.graph; //remove the button- prefix from the name to get the graph name

		dim = [0.05, 0.05, 0.01];
		this.activeGraph = graph;
		this.buttons.push(
			spawnBlockButton(
				"saveTo",
				"#EF8354",
				[0.42, 0.15, 0],
				dim,
				this.el,
				"#5f5f5f"
			)
		);
		this.buttons.push(
			spawnBlockButton("rename", "#4F5D75", [0.42, 0.07, 0], dim, this.el)
		);
		this.buttons.push(
			spawnBlockButton("genConfFile", "#4F5D75", [0.42, -0.01, 0], dim, this.el)
		);
		this.buttons.push(
			spawnBlockButton("removeGraph", "#4F5D75", [0.42, -0.09, 0], dim, this.el)
		);

		this.el.emit("graphactive", { graph: this.activeGraph });

		slate = document.querySelector(`#data-slate-${this.activeGraph.data.name}`);
		if (slate == null) {
			slate = document.createElement("a-entity");
			slate.setAttribute("id", `data-slate-${this.activeGraph.data.name}`);
			slate.setAttribute("dataslate", { graph: this.activeGraph.el.id });
			this.el.sceneEl.appendChild(slate);
		} else {
			slate.object3D.visible = true;
			slate.components.dataslate.addEventListeners();
		}
	},

	/*Method: setGraphInactive
		Deactivates the currently active graph and removes the corresponding buttons and turns the slate invisible.
		Called by the toggleGraph event handler when a graph button is pressed.

		Parameters:
			event - the event object deliverd by the button passed on by the handler
	*/
	setGraphInactive: function (event) {
		this.el.emit("graphinactive");

		slate = document.querySelector(`#data-slate-${this.activeGraph.data.name}`);
		if (slate != null) {
			slate.object3D.visible = false;
			slate.removeState("scrolling"); //get rid of any scrolling state
			slate.components.dataslate.removeEventListeners();
		}
		this.activeGraph = null;

		this.buttons.forEach((button) => {
			this.el.removeChild(button);
			button.destroy();
		});
		this.buttons = [];
	},

	/*Method: shiftButton
		Shifts the position of the given button and recursively calls itself on the remaining buttons.
		Called by the removeGraph event handler to update positions of all graph buttons.

		Parameters:
			graph - the graph-entity, whose button needs to be shifted
			pos - the position the button should be shifted to
			remaining - the remaining graphs that need to be shifted
	*/
	shiftButton: function (graph, pos, remaining) {
		let b = document.querySelector(
			`#button-${graph.components.graph.data.name}`
		);
		let posCopy = b.object3D.position.clone().toArray();
		b.object3D.position.set(...pos);
		if (remaining.length > 0) {
			this.shiftButton(remaining[0], posCopy, remaining.slice(1));
		}
	},
});

/*Class: dataslate-component

	Attached to a box-entity spawned by the controlpanel-component.
	Creates a panel with the current state as virtual buttons (one per ket) and displays the target state.

	Listeners:
		PMsUpdated - (on document) updateSlate:
		tooglePM_<i> - (on self) spawnPM/removePM: (i is the index of the pm)
*/
AFRAME.registerComponent("dataslate", {
	/*Property: schema

		Parameters:
			graph - the graph entity name the dataslate belongs to
	*/
	schema: { graph: { type: "string" } },

	/*Property: Attributes
		this.graph - the graph entity the dataslate belongs to
		this.scrollSpeed - the speed at which the slate is currently scrolled
		this.buttons - the buttons on the dataslate

	*/

	//Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Sets the geometry and physics of the dataslate and adds the event listeners.
	*/
	init: function () {
		this.graph = document.querySelector("#" + this.data.graph).components.graph;
		this.scrollSpeed = 0;
		//define geometry and physics characteristics
		slate.setAttribute("geometry", {
			primitive: "box",
			width: 0.2,
			height: 0.3,
			depth: 0.01,
		});
		slate.setAttribute("material", { color: "#2D3142" });
		slate.setAttribute("position", { x: -0.5, y: 1.2, z: 0 });
		slate.setAttribute("rotation", { x: 0, y: 90, z: 0 });

		slate.setAttribute("dynamic-body", { shape: "box", mass: 100 });
		slate.setAttribute("sleepy", { linearDamping: 0.9, angularDamping: 0.9 });
		slate.setAttribute("collision-filter", {
			group: "ui",
			collidesWith: ["default", "hands"],
		});
		slate.setAttribute("grabbable", {
			startButtons: "gripdown",
			endButtons: "gripup",
		});

		//add event listeners
		this.addEventListeners();
		this.fillSlate(this.graph);
	},

	/*function: remove
		remove-handler
		called upon slate removal. cleans up the event listeners and disposes of the geometry and material.
	*/
	remove: function () {
		this.removeEventListeners();
		cleanUpObject(this.el.object3D);
	},

	/*function: tick
		tick-handler
		called every frame. scrolls the slate if it is in the scrolling state.
	*/
	tick: function () {
		if (this.el.is("scrolling")) {
			this.scrollPM(this.scrollSpeed);
		}
		if (this.el.object3D.visible == false) {
			this.el.body.sleep();
		}
	},

	//Group: event-handlers
	// ----------------------------------------------

	events: {
		/*Function:spawnPM
			Called when a pm-button is pressed.
			Spawns the corresponding pm and adds the removePM event listener to the button.

			Parameters:
				event - the event object deliverd by the button
		*/
		spawnPM: function (event) {
			const name = event.detail.name;
			const pmIndex = Number(name.slice(name.indexOf("_") + 1));
			this.graph.spawnPM(pmIndex);

			this.el.removeEventListener("togglePM_" + pmIndex, this.events.spawnPM);
			this.el.addEventListener("togglePM_" + pmIndex, this.events.removePM);
		},

		/*Function:removePM
			Called when a pm-button is pressed.
			Removes the corresponding pm and adds the spawnPM event listener to the button.

			Parameters:
				event - the event object deliverd by the button
		*/
		removePM: function (event) {
			const name = event.detail.name;
			const pmIndex = Number(name.slice(name.indexOf("_") + 1));

			this.graph.removePM(pmIndex);

			this.el.removeEventListener("togglePM_" + pmIndex, this.events.removePM);
			this.el.addEventListener("togglePM_" + pmIndex, this.events.spawnPM);
		},

		/*Function:updateSlate
			Called when the graph updates it's PMS
			Updates the slate to reflect the new PMs

			Parameters:
				event - the event object deliverd by the graph
		*/
		updateSlate: function (event) {
			if (event.detail.graph == this.graph) {
				this.emptySlate();
				this.fillSlate(this.graph);
			}
		},
	},

	//Group: methods
	// ----------------------------------------------

	/*Method: addEventListeners
		Adds the event listeners to the dataslate.
	*/
	addEventListeners: function () {
		const pmCount = this.graph.currentStateStrings.length;
		if (pmCount > 17) {
			document.addEventListener(
				"thumbsticktouchstart",
				(f = (e) => {
					this.el.addState("scrolling");
				})
			);
			document.addEventListener(
				"thumbsticktouchend",
				(f = (e) => {
					this.el.removeState("scrolling");
				})
			);
			document.addEventListener(
				"thumbstickmoved",
				(f = (e) => {
					this.scrollSpeed = e.detail.y;
				})
			);
		}
		document.addEventListener("PMsUpdated", this.events.updateSlate);
	},

	/*Method: removeEventListeners
		Removes the event listeners from the dataslate.
	*/
	removeEventListeners: function () {
		console.log("removing event listeners");
		const pmCount = this.graph.currentStateStrings.length;
		if (pmCount > 17)
			document.removeEventListener(
				"thumbsticktouchstart",
				(f = (e) => {
					this.el.addState("scrolling");
				})
			);
		document.removeEventListener(
			"thumbsticktouchend",
			(f = (e) => {
				this.el.removeState("scrolling");
			})
		);
		document.removeEventListener(
			"thumbstickmoved",
			(f = (e) => {
				this.el.removeState("scrolling");
			})
		);
		document.removeEventListener("PMsUpdated", this.events.updateSlate);
	},

	/*Method: fillSlate
		Fills the dataslate with buttons for the current PMs and the target state.
		Called during initialisation and by the updateSlate event handler when the graph updates it's PMs.

		Parameters:
			graph - the graph entity the dataslate belongs to

	*/
	fillSlate: function (graph) {
		slate = this.el;
		this.buttons = [];

		graph.currentStateStrings.map((str, i) => {
			this.buttons.push(
				spawnBlockButton(
					`togglePM_` + i,
					"#EF8354",
					[-0.05, 0.135 - i * 0.016, 0.0051],
					[0.09, 0.015, 0.0001],
					slate,
					"white",
					graph.currentStateWeights[i] + " " + str
				)
			);
			if (i > 17) {
				this.buttons[i].setAttribute("visible", false);
				this.buttons[i].setAttribute("enabled", false);
			}
			this.el.addEventListener("togglePM_" + i, this.events.spawnPM);
		});

		let k = "TARGET STATE: \n \n";
		if (graph.graphData.graph.target_state != undefined) {
			graph.graphData.graph.target_state.forEach((state, j) => {
				if (graph.graphData.graph.amplitudes != undefined) {
					k += `${graph.graphData.graph.amplitudes[j]} |${state}> \n`;
				} else {
					k += `|${state}> \n`;
				}
			});
		}
		k = k.slice(0, -1);

		slate.setAttribute("text", {
			color: "white",
			anchor: "left",
			align: "left",
			zOffset: 0.00501,
			xOffset: 0.01,
			value: k,
		});
	},

	/*Method: emptySlate	
		Empties the dataslate of all buttons.
		Called by the updateSlate event handler when the graph updates it's PMs.
	*/
	emptySlate: function () {
		this.buttons.forEach((button) => {
			if (button.is("pushed")) {
				button.components.button.fakeClick();
			}
			this.el.removeChild(button);
			button.destroy();
		});
	},

	/*Method: scrollPM
		Scrolls the dataslate-buttons by the given amount.
		Called by the tick handler when the dataslate is in the scrolling state.

		Parameters:
			scrollSpeed - the amount the slate should be scrolled
	*/
	scrollPM: function (scrollSpeed) {
		this.buttons.forEach((button, i) => {
			if (i == 0) {
				switch (scrollSpeed < 0) {
					case true:
						if ((button.object3D.position.y - 0.135) ** 2 <= 0.005 ** 2) {
							scrollSpeed = 0;
						}
						break;

					case false:
						let l = this.buttons.length - 17;
						if (
							(button.object3D.position.y - l * 0.016 - 0.135) ** 2 <=
							0.005 ** 2
						) {
							scrollSpeed = 0;
						}
						break;
				}
			}
			button.object3D.position.y += scrollSpeed / 150;

			if (
				button.object3D.position.y > 0.15 ||
				button.object3D.position.y < -0.15
			) {
				button.object3D.visible = false;
			} else {
				button.object3D.visible = true;
			}
		});
	},
});

/*Class: button-component

	Attached to a box-entity spawned by the controlpanel-component or the dataslate-component.
	Creates a button with the given label and emits the given event when pressed.
	The button can be pushed and released by the user or by the API if the clickable flag is set to true.
	SpringLoaded buttons return to their original position after being pushed.
	raycastable buttons can be pushed by raycaster interaction.

	A entity can have multiple button components.

	Listeners:
		<clickEvent> - (on self) onButtonClick

	Events:
		<event> - emitted when the button is clicked. detail: {button: this, name: this.el.id, pushed: this.el.is("pushed")}
*/
AFRAME.registerComponent("button", {
	/*Property: schema

		Parameters:

			event - the event to be emitted when the button is clicked
			clickEvent - the event to be listened to for clicks
			clickable - flag deciding whether the button is pushable by physical interaction or not
			springLoaded - flag deciding whether the button stays pushed or not
			raycastable - flag deciding whether the button can be pushed by raycaster interaction
	*/

	schema: {
		event: { type: "string", default: "none" }, // event to be emitted on click
		clickEvent: { type: "string", default: "triggerdown" }, // event to be listened to for click
		clickable: { type: "boolean", default: false }, // flag deciding whether the button is pushable by physical interaction or not
		springLoaded: { type: "boolean", default: false }, // flag deciding whether the button stays pushed or not
		raycastable: { type: "boolean", default: false },
	},

	multiple: true,

	//Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Sets the initial state of the button and adds the event listeners.
	*/
	init: function () {
		this.el.addState("enabled");
		this.origColor = this.el.object3DMap.mesh.material.color.clone();
		this.hoverColor = 0xea5c1f;
		this.pushedColor = 0x2a6564;
		if (this.data.raycastable) {
			this.el.setAttribute("raycastable");
		}
		if (this.data.clickable) {
			document.addEventListener(
				this.data.clickEvent,
				this.events.onButtonClick
			);
			this.el.addEventListener(
				"raycaster-intersected",
				(f = (e) => {
					this.el.object3DMap.mesh.material.color.setHex(this.hoverColor);
					this.el.addState("hovered");
				})
			);
			this.el.addEventListener(
				"raycaster-intersected-cleared",
				(f = (e) => {
					if (this.el.is("pushed") == false) {
						this.el.object3DMap.mesh.material.color.set(this.origColor);
					} else {
						this.el.object3DMap.mesh.material.color.setHex(this.pushedColor);
					}
					this.el.removeState("hovered");
				})
			);
			//	this.el.setAttribute("static-body", { shape: "box" });
			//	this.el.setAttribute("sleepy", {});
			//	this.el.setAttribute("collision-filter", {
			//		collisionForces: false,
			//		group: "button",
			//		collidesWith: "hands",
			//});
		} else {
			this.el.addEventListener(this.data.clickEvent, this.events.onButtonClick);
		}
	},

	/*function: update
		update-handler
		updates the button geometry label if it has changed
		used during graph renaming for the graph control panel buttons

		Parameters:
			oldData - the old data object of the button
	*/
	update: function (oldData) {
		if (oldData.label != this.data.label) {
			this.el.setAttribute("text", { value: this.data.label });
		}
	},

	/*function: remove
		remove-handler
		called upon button removal. cleans up the event listeners and disposes of the geometry and material.
	*/
	remove: function () {
		this.el.removeState("hovered");
		document.removeEventListener(
			this.data.clickEvent,
			this.events.onButtonClick
		);
		this.el.removeEventListener(
			this.data.clickEvent,
			this.events.onButtonClick
		);
		this.el.removeEventListener("raycaster-intersected", f);
		this.el.removeEventListener("raycaster-intersected-cleared", f);
		cleanUpObject(this.el.object3D);
	},

	/*function: tick
		tick-handler
		called every frame. Checks for visibility.
		turns of physics and button functionality if button is not visible return when visible again
	*/
	tick: function () {
		// turn of physics and button functionality if button is not visible return when visible again
		if (
			this.el.object3D.visible == false ||
			this.el.parentNode.object3D.visible == false
		) {
			if (this.el.is("enabled") == true) {
				this.el.removeState("enabled");
			}
			if (this.data.raycastable) {
				this.el.removeAttribute("raycastable");
			}
		} else {
			if (this.el.is("enabled") == false) {
				this.el.addState("enabled");
			}

			if (this.data.raycastable) {
				this.el.setAttribute("raycastable");
			}
		}
	},

	//Group: event-handlers
	// ----------------------------------------------
	events: {
		/*Function:onButtonClick
			Called when the button is clicked.
			Emits the event defined in the schema and pushes or releases the button depending on it's current state.
		*/
		onButtonClick: function () {
			if (this.el.is("enabled")) {
				if (
					!this.data.clickable ||
					(this.el.is("hovered") && this.data.clickable)
				) {
					this.feedbackClick();
					let detail = {
						button: this,
						name: this.el.id,
						pushed: this.el.is("pushed"),
					};
					this.el.emit(this.data.event, detail, true);
				}
			}
		},
	},

	//Group: methods
	// ----------------------------------------------

	/*Method: fakeClick
		Forces a button click emission via API not via user input.
	*/
	fakeClick: function () {
		//this method exists to force a button click via API not via user input
		this.feedbackClick();
		let detail = {
			button: this,
			name: this.el.id,
			pushed: this.el.is("pushed"),
		};
		this.el.emit(this.data.event, detail, true);
	},

	/*Method: feedbackClick
		Handles the physical button push and release in case of springLoaded buttons.
	*/
	feedbackClick: function () {
		switch (this.el.is("pushed")) {
			case true:
				this.releaseButton();
				break;
			case false:
				this.pushButton();

				if (this.data.springLoaded) {
					setTimeout(() => {
						this.releaseButton();
					}, 200);
				}

				break;
		}
	},

	/*Method: releaseButton
		Releases the button, both physically, if applicable, and by changing the color.
	*/
	releaseButton: function () {
		this.el.removeState("pushed");

		switch (this.data.clickable) {
			case true:
				this.el.object3D.translateZ(
					0.2 * this.el.object3DMap.mesh.geometry.parameters.depth
				);
				this.el.object3DMap.mesh.material.color.set(this.origColor);

				break;

			case false:
				this.el.object3DMap.mesh.material.color.setHex(0xff0000);

				this.el.object3D.scale.set(1, 1, 1);

				break;
		}
	},

	/*Method: pushButton
		Pushes the button, both physically, if applicable, and by changing the color.
	*/
	pushButton: function () {
		this.el.addState("pushed");

		switch (this.data.clickable) {
			case true:
				this.el.object3D.translateZ(
					-0.2 * this.el.object3DMap.mesh.geometry.parameters.depth
				);
				this.el.object3DMap.mesh.material.color.setHex(this.pushedColor);

				break;
			case false:
				this.el.object3DMap.mesh.material.color.setHex(0x00ff00);

				this.el.object3D.scale.set(0.9, 0.9, 0.9);
				break;
		}
	},
});

/*Class: controller-menu-component
	Attached to controllers to provide a menu system.
	Spawns a menu with the given buttons and submenus navigated via controller joysticks and a selection indicator.
	Buttons can be pressed via controller buttons.

	Listeners:
		thumbstickmoved - moveSelector
		spawnkeypressed - toggleMenu
		<actionkey> - triggerButton
		<button> - toggleMenu
	
	Events:
*/
AFRAME.registerComponent("controller-menu", {
	/*Property: schema

		Parameters:
			buttons - list of buttons of the menu
			subMenus - list of lists, the submenus of the menu
			spawnKey - the key to spawn the menu
			actionKey - the key to press buttons/spawn submenus
	*/
	schema: {
		buttons: { type: "string" },
		subMenus: { type: "string", default: "[]" },
		spawnKey: { type: "string", default: "abuttondown" },
		actionKey: { type: "string", default: "bbuttondown" },
	},

	/*Property: Attributes
		this.menu - the menu entity
		this.buttons - the buttons of the menu
		this.subMenus - the submenus of the menu
		this.active - flag indicating whether the menu is active or not
		this.selector - the selector entity
	*/

	multiple: true,

	//Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Reads the menu data from the schema and sets up the event listeners.
		Creates the menu object and sets up the menu selector.
	*/
	init: function () {
		// read menu data from schema
		this.data.buttons = this.data.buttons;
		this.data.subMenus = this.data.subMenus;

		// set up event listeners
		this.el.addEventListener(this.data.spawnKey, this.events.spawnKeyPressed);
		this.el.addEventListener("spawnkeypressed", this.events.toggleMenu);
		this.el.addEventListener(this.data.actionKey, this.events.triggerButton);

		if (this.data.subMenus.length > 0) {
			this.data.buttons.forEach((button, j) => {
				if (this.data.subMenus[j].length != 0) {
					this.el.addEventListener(button, this.events.toggleMenu);
				}
			});
		}

		// set up menu selector
		this.selector = document.createElement("a-entity");
		const selGeo = new THREE.PlaneGeometry(0.15, 0.025);
		const selMat = new THREE.MeshBasicMaterial({
			color: "#00008b",
			opacity: 0.4,
			transparent: "True",
		});
		const selPlane = new THREE.Mesh(selGeo, selMat);

		this.selector.setAttribute("id", `${this.el.id}-selector`);
		this.selector.setObject3D("sel", selPlane);
		this.selector.object3D.position.set(0.045, 0, -0.00001);

		// set up menu
		this.menu = this.makeMenu("main", this.data.buttons);
		this.el.appendChild(this.menu.menu);
		this.menu.buttons[0].appendChild(this.selector);

		// Setting of submenus is a bit cumbersome ¯\_(ツ)_/¯ possibly this can be done in a sleek recursive way
		if (this.data.subMenus.length != 0) {
			this.subActive = false;

			this.data.subMenus.forEach((subMenuData, i) => {
				subMenu = this.makeMenu("sub", subMenuData, i, this.menu);
				this.menu.children.push(subMenu);
				this.menu.buttons[i].appendChild(subMenu.menu);
			});
		}
	},

	/*function: remove
		remove-handler
		called upon component removal. cleans up the event listeners and disposes of the geometry and material.
	*/
	remove: function () {
		this.el.removeChild(this.menu.menu);
		cleanUpObject(this.menu.menu.object3D);
		this.el.removeEventListener("thumbstickmoved", this.events.moveSelector);
		this.el.removeEventListener(
			this.data.spawnKey,
			this.events.spawnKeyPressed
		);
		this.el.removeEventListener(this.data.actionKey, this.events.triggerButton);
		if (this.data.subMenus.length > 0) {
			this.data.buttons.forEach((button) => {
				this.el.removeEventListener(button, this.events.toggleMenu);
			});
		}
		this.menu.menu.destroy();
	},

	//Group: event-handlers
	// ----------------------------------------------

	events: {
		/*Function:spawnKeyPressed
			Called when the spawn key is pressed.
			Proxy to allow custom spawn keys.

			emits spawnkeypressed event with the name "main"
		*/
		spawnKeyPressed: function () {
			this.el.emit("spawnkeypressed", { name: "main" });
		},

		/*Function:toggleMenu
			Called on "spankeypressed" or subMenu button presses.
			Spawns or kills the menu based on its current state and the type of menu being toggled.

			Parameters:
				event - the event object deliverd by spawnKeyPressed or the button
		*/
		toggleMenu: function (event) {
			// spawns or kills the menu based on its current state and the type of menu being toggled

			// select the current menu
			let menu =
				event.detail.name == "main"
					? this.menu
					: this.findCurrentMenu(this.menu).children.find(
							(child) => child.name == event.detail.name
					  );

			// if the lowest active menu has no children, the menu is the lowest active menu
			if (menu == undefined) {
				menu = this.findCurrentMenu(this.menu);
			}

			menu.menu.object3D.visible = !menu.active;
			menu.active = !menu.active;

			// fist, enable/disable the thumbstick event listener to move the selector when the main menu is spawned/killed
			if (event.detail.name == "main" && menu.active == false) {
				this.el.removeEventListener(
					"thumbstickmoved",
					this.events.moveSelector
				);
				this.el.removeEventListener(
					this.data.actionKey,
					this.events.triggerButton
				);
			} else if (event.detail.name == "main" && menu.active == true) {
				this.el.addEventListener(
					this.data.actionKey,
					this.events.triggerButton
				);
				this.el.addEventListener("thumbstickmoved", this.events.moveSelector);
			}

			// for submenus move the selector to the correct menu
			else if (event.detail.name != "main" && menu.active == false) {
				menu.menu.parentNode.appendChild(this.selector);
			} else if (event.detail.name != "main" && menu.active == true) {
				menu.buttons[0].appendChild(this.selector);
			}
		},

		/*Function:moveSelector
			Called when the thumbstick is moved.
			Moves the selector based on the thumbstick input which changes the selected button.

			Parameters:
				event - the event object deliverd by the thumbstick from superhands
		*/
		moveSelector: function (event) {
			// moves the selector based on the thumbstick input which changes the selected button

			this.el.removeEventListener("thumbstickmoved", this.events.moveSelector); // prevents the thumbstick from being spammed

			const selector = this.selector;
			let currentMenu = this.findCurrentMenu(this.menu);
			const currentButton = selector.parentNode;
			let horizontal = false;

			let buttonIndex = currentMenu.buttons.indexOf(currentButton);

			currentButton.removeChild(selector);

			//vertical movement
			if (event.detail.y > 0.5 && buttonIndex != 0) {
				buttonIndex -= 1;
			} else if (event.detail.y > 0.5 && buttonIndex == 0) {
				buttonIndex = currentMenu.buttons.length - 1;
			} else if (
				event.detail.y < -0.5 &&
				buttonIndex != currentMenu.buttons.length - 1
			) {
				buttonIndex += 1;
			} else if (
				event.detail.y < -0.5 &&
				buttonIndex == currentMenu.buttons.length - 1
			) {
				buttonIndex = 0;
			}

			//horizontal movement
			else if (event.detail.x < -0.5 && currentMenu.name != "main") {
				// go right. i.e. spawn submenu
				let name = currentMenu.name;
				currentMenu = currentMenu.parent;
				buttonIndex = currentMenu.children.indexOf(
					currentMenu.children.find((child) => child.name == name)
				);
				horizontal = true;
			} else if (event.detail.x > 0.5 && currentMenu.name == "main") {
				// go left. i.e. kill submenu
				horizontal = true;
			}

			currentMenu.buttons[buttonIndex].appendChild(selector);

			//spawns/kills submenu
			if (horizontal) {
				this.events.triggerButton();
			}

			//timout to prevent too fast scrolling
			setTimeout(() => {
				this.el.addEventListener("thumbstickmoved", this.events.moveSelector);
			}, 100);
		},

		/*Function:triggerButton
			Called when the action key is pressed.
			Triggers the button the selector is currently on.
		*/
		triggerButton: function () {
			const button = this.selector.parentNode;
			button.components.button.events.onButtonClick();
		},
	},

	//Group: methods
	// ----------------------------------------------

	/*Method: makeMenu
		Creates the object3D representation of the menu with it's buttons and submenus.

		Parameters:
			type - the type of menu to be created, sub or main
			buttons - the buttons of the menu
			subIndex - the index of the menu in the parent menu
			parent - the parent menu
			children - the submenus of the menu

		Returns:
			menuObj - the menu object with the menu entity, the buttons, the parent and the children
	*/
	makeMenu: function (
		type,
		buttons,
		subIndex = undefined,
		parent = undefined,
		children = null
	) {
		// creates the menu object based on the type of menu being created and the parent menu if it exists
		let rot;
		let pos;
		let id;

		switch (type) {
			case "main":
				rot = new THREE.Euler(-Math.PI / 4, 0, 0); // rotation of the main menu
				pos = [0, (0.03 * this.data.buttons.length) / 2, -0.2];
				id = "main";

				break;

			case "sub":
				rot = new THREE.Euler(0, 0, 0); // submenus inherit theur rotation from their parent
				pos = [0.17, 0, 0.001]; // shift to the right of the parent menu and z-Offset to avoid z-fighting
				id = parent.buttons[subIndex].id;
				break;
		}

		let menu = document.createElement("a-entity"); // creates the menu entity
		menu.object3D.visible = false; // hides the menu until it is spawned
		let menuObj = {
			menu: menu,
			name: type == "main" ? "main" : parent.buttons[subIndex].id,
			buttons: [],
			parent: parent,
			children: [],
			active: false,
		}; // initialised empty menu object to be returned

		// creates the menu plane and the button planes

		const paperGeo = new THREE.PlaneGeometry(0.13, 0.03 * buttons.length);
		const paperMat = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			opacity: 0.4,
			transparent: "True",
		});
		const plane = new THREE.Mesh(paperGeo, paperMat);

		menu.setAttribute("id", id);
		menu.setObject3D("paper", plane);

		menu.object3D.position.set(pos[0], pos[1], pos[2]);
		menu.object3D.setRotationFromEuler(rot);

		// creates the buttons and adds them to the menu
		buttons.forEach((b, j) => {
			let button = document.createElement("a-entity");
			menu.appendChild(button);

			const buttonGeo = new THREE.PlaneGeometry(0.02, 0.015);
			const buttonMat = new THREE.MeshBasicMaterial({ color: "#FF0000" });
			const buttonPlane = new THREE.Mesh(buttonGeo, buttonMat);

			button.setAttribute("button", {
				event: b,
				clickEvent: this.data.actionKey,
				springLoaded: type == "main" ? false : true,
			});
			button.setAttribute("id", b);

			button.object3D.position.set(
				-0.045,
				0.015 - buttons.length * 0.015 + 0.03 * j,
				0.001
			);

			// button text
			button.setAttribute("text", {
				width: 0.2,
				height: 0.09,
				zOffset: 0.001,
				xOffset: 0.016,
				anchor: "left",
				align: "left",
				value: b,
				color: "#000000",
			});

			button.setObject3D("mesh", buttonPlane);
			menuObj.buttons.push(button);
		});

		return menuObj;
	},

	/*Method: findCurrentMenu
		Finds the lowest active menu in the menu tree.

		Parameters:
			menu - the menu to start the search from

		Returns:
			menu - the lowest active menu
	*/
	findCurrentMenu: function (menu) {
		if (menu.children.length != 0) {
			if (!menu.children.some((child) => child.active == true)) {
				return menu;
			} else
				return this.findCurrentMenu(
					this.menu.children.find((menu) => menu.active == true)
				);
		} else return menu;
	},
});

/*Class: disc-menu-component
	Attached to controllers to provide a menu system for edge weight selection via an euler disc
	Spawns a disc with a selector that can be moved via the controller thumbstick.
	The selector position is translated into a weight and phase value that is emitted when the thumbstick is pressed.

	Listeners:
		thumbstickmoved - moveSelector
		thumbstickdown - emit weightSelected
		thumbsticktouchstart - moveSelector
		thumbsticktouchend - moveSelector
	
	Events:
		weightSelected - emitted when the thumbstick is pressed. detail: {amplitude: this.menuState.amplitude, phase: this.menuState.phase}
*/
AFRAME.registerComponent("disc-menu", {
	/*Property: schema

		Parameters:
			radius - the radius of the disc
			type - the type of the menu
	*/
	schema: {
		radius: { type: "number", default: 0.05 },
		type: { type: "string", default: "weightSelector" },
	},

	/*Property: Attributes
		this.menu - the menu entity
		this.t1 - the coordinate system labels 
		this.t2 - the coordinate system labels
		this.t3 - the coordinate system labels 
		this.t4 - the coordinate system labels 
		this.display - the display text entity
		this.selector - the selector entity
		this.move - flag indicating whether the selector is being moved or not
		this.menuState - the current state of the menu
		this.loaded - flag indicating whether the menu is loaded or not
		this.tx - container for the x-coordinate of the selector
		this.ty - container for the y-coordinate of the selector
		this.stick - container for the controller being touched (left or right)
	*/

	//Group: lifecycle-handlers

	/*Constructor: init
		Initialises the component.
		Sets up the event listeners and creates the menuState object.
	*/
	init: function () {
		this.createObject(this.data.type);
		this.menuState = {};

		document.addEventListener(
			"thumbsticktouchstart",
			(f = (e) => {
				this.move = true;
			})
		);
		document.addEventListener(
			"thumbsticktouchend",
			(f = (e) => {
				this.move = false;
			})
		);
		document.addEventListener("thumbstickmoved", this.events.readThumbstick);
		this.el.addEventListener(
			"thumbstickdown",
			(f = (e) => {
				this.el.emit("weightSelected", this.menuState);
			})
		);
	},

	/*function: update 
		update-handler
		called upon component update and after init(). updates the menuState object based on the menu type.
	*/
	update: function () {
		switch (this.data.type) {
			case "weightSelector":
				this.menuState = { amplitude: 1, phase: 0 };
				break;
			default:
				break;
		}
	},

	/*function: remove
		remove-handler
		called upon component removal. cleans up the event listeners and disposes of the geometry and material.
	*/
	remove: function () {
		document.removeEventListener("thumbsticktouchstart", f);
		document.removeEventListener("thumbsticktouchend", f);
		document.removeEventListener("thumbstickmoved", this.events.readThumbstick);
		this.el.removeEventListener("thumbstickdown", f);

		this.el.removeChild(this.t1);
		this.el.removeChild(this.t2);
		this.el.removeChild(this.t3);
		this.el.removeChild(this.t4);

		this.el.removeChild(this.display);
		cleanUpObject(this.menu);
	},

	/*function: tick
		tick-handler
		called every frame. 
		Updates the menuState object and the display text based on the selector position if the selector is currently moving.
	*/
	tick: function () {
		if (this.move == true) {
			if (this.loaded == true) {
				this.menuState.phase = this.selector.position.angleTo(
					new THREE.Vector3(1, 0, 0)
				);
				this.menuState.phase =
					this.selector.position.y >= 0
						? this.menuState.phase
						: 2 * Math.PI - this.menuState.phase;
				this.menuState.phase = this.menuState.phase / Math.PI;
				this.menuState.amplitude =
					Math.sqrt(
						this.selector.position.x ** 2 + this.selector.position.y ** 2
					) /
					(0.9 * this.data.radius);
			}

			this.moveSelector();
			this.display.setAttribute(
				"value",
				`amplitude: ${this.menuState.amplitude.toFixed(
					2
				)} \n phase: ${this.menuState.phase.toFixed(2)} `
			);
		}
	},

	//Group: event-handlers
	// ----------------------------------------------
	events: {
		/*Function:readThumbstick
			Called when the thumbstick is moved.
			Reads thumbstick values and stores them in attributes.

			Parameters:
				event - the thumbstickmoved evebt object deliverd by the thumbstick from superhands
		*/
		readThumbstick: function (event) {
			console.log(event);
			let ty = -event.detail.y * 0.9 * this.data.radius;
			let tx = event.detail.x * 0.9 * this.data.radius;

			this.ty = ty;
			this.tx = tx;
			this.stick = event.target.id;
		},
	},

	//Group: methods
	// ----------------------------------------------

	/*Method: createObject
		Creates the object3D representation of the menu

		Parameters:
			type - the type of menu to be created
	*/
	createObject: function (type) {
		const radius = this.data.radius;

		//create the menu plane
		const plane = new THREE.CircleGeometry(radius, 32);
		const material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			opacity: 0.4,
			transparent: "True",
		});

		const background = new THREE.Mesh(plane, material);
		this.el.object3D.add(background);
		background.position.set(-0.02, 0.09, -0.1);
		background.rotation.set(-Math.PI / 2, 0, 0.13);

		//coordinate system drawing
		const coordSys = new THREE.Group();
		const axisGeo = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(0, -radius * 0.9, 0),
			new THREE.Vector3(0, radius * 0.9, 0),
		]);
		const axisMat = new THREE.LineBasicMaterial({ color: 0x000000 });
		const tickGeo = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(-0.003, 0, 0),
			new THREE.Vector3(0.003, 0, 0),
		]);

		const xAxis = new THREE.Line(axisGeo, axisMat);
		const tick = new THREE.Line(tickGeo, axisMat);

		for (let i = 0; i < 21; i++) {
			let t = tick.clone();
			t.position.set(0, -radius * 0.9 + (i * radius * 0.9) / 10, 0);
			xAxis.add(t);
		}

		const yAxis = xAxis.clone().rotateZ(Math.PI / 2);
		coordSys.add(xAxis);
		coordSys.add(yAxis);
		background.add(coordSys);

		// draw fixpoints and mobile selector
		const markerMat = new THREE.MeshBasicMaterial({ color: "#DC3220" });
		const markerGeo = new THREE.SphereGeometry(0.003, 12, 12);

		const fixPoints = new THREE.InstancedMesh(markerGeo, markerMat, 16);
		const scaleMatrix = new THREE.Matrix4().makeScale(0.5, 0.5, 0.5);

		for (let i = 0; i < 16; i++) {
			if (i < 8) {
				// first 8 markers sit at weight = 0.5
				fixPoints.setMatrixAt(
					i,
					new THREE.Matrix4()
						.makeTranslation(
							0.5 * radius * 0.9 * Math.cos((i * Math.PI) / 4),
							0.5 * radius * 0.9 * Math.sin((i * Math.PI) / 4),
							0
						)
						.multiply(scaleMatrix)
				);
			} else {
				// second 8 markers sit at weight = 1
				fixPoints.setMatrixAt(
					i,
					new THREE.Matrix4()
						.makeTranslation(
							radius * 0.9 * Math.cos((i * Math.PI) / 4),
							radius * 0.9 * Math.sin((i * Math.PI) / 4),
							0
						)
						.multiply(scaleMatrix)
				);
			}

			fixPoints.setColorAt(i, new THREE.Color(0x000000));
		}

		fixPoints.instanceMatrix.needsUpdate = true;
		fixPoints.instanceColor.needsUpdate = true;
		fixPoints.name = "fixPoints";
		background.add(fixPoints);

		// selector
		const selector = new THREE.Mesh(markerGeo, markerMat);
		selector.position.set(radius * 0.9, 0, 0);
		background.add(selector);

		this.selector = selector;
		this.loaded = true;
		background.name = "menu";
		this.menu = background;

		// add text

		this.t1 = document.createElement("a-text");
		this.t1.setAttribute("value", "-i");
		this.t1.setAttribute("color", "black");
		this.t1.setAttribute("anchor", "center");
		this.t1.setAttribute("align", "center");
		this.t1.setAttribute(
			"position",
			`${this.menu.position.x} ${this.menu.position.y} ${
				this.menu.position.z + 0.9 * this.data.radius
			}`
		);
		this.t1.setAttribute("rotation", `${this.menu.rotation.x - 90} ${7} ${0}`);
		this.t1.setAttribute("width", 0.2);

		this.t2 = document.createElement("a-text");
		this.t2.setAttribute("value", "i");
		this.t2.setAttribute("color", "black");
		this.t2.setAttribute("anchor", "center");
		this.t2.setAttribute("align", "center");
		this.t2.setAttribute(
			"position",
			`${this.menu.position.x} ${this.menu.position.y} ${
				this.menu.position.z - 0.9 * this.data.radius
			}`
		);
		this.t2.setAttribute("rotation", `${this.menu.rotation.x - 90} ${7} ${0}`);
		this.t2.setAttribute("width", 0.2);

		this.t3 = document.createElement("a-text");
		this.t3.setAttribute("value", "1");
		this.t3.setAttribute("color", "black");
		this.t3.setAttribute("anchor", "center");
		this.t3.setAttribute("align", "center");
		this.t3.setAttribute(
			"position",
			`${this.menu.position.x + 0.9 * this.data.radius} ${
				this.menu.position.y
			} ${this.menu.position.z}`
		);
		this.t3.setAttribute("rotation", `${this.menu.rotation.x - 90} ${7} ${0}`);
		this.t3.setAttribute("width", 0.2);

		this.t4 = document.createElement("a-text");
		this.t4.setAttribute("value", "-1");
		this.t4.setAttribute("color", "black");
		this.t4.setAttribute("anchor", "center");
		this.t4.setAttribute("align", "center");
		this.t4.setAttribute(
			"position",
			`${this.menu.position.x - 0.9 * this.data.radius} ${
				this.menu.position.y
			} ${this.menu.position.z}`
		);
		this.t4.setAttribute("rotation", `${this.menu.rotation.x - 90} ${7} ${0}`);
		this.t4.setAttribute("width", 0.2);

		this.el.appendChild(this.t1);
		this.el.appendChild(this.t2);
		this.el.appendChild(this.t3);
		this.el.appendChild(this.t4);

		display = document.createElement("a-text");
		display.setAttribute("value", "amplitude: 1.00\nphase: 0.00  ");
		display.setAttribute("color", "black");
		display.setAttribute("anchor", "center");
		display.setAttribute("align", "center");
		display.setAttribute(
			"position",
			`${this.menu.position.x - 0.01} ${this.menu.position.y} ${
				this.menu.position.z - 1.1 * this.data.radius
			}`
		);
		display.setAttribute("rotation", `${this.menu.rotation.x - 90} ${7} ${0}`);
		display.setAttribute("width", 0.2);
		this.display = display;

		this.el.appendChild(display);
	},

	/*Method: moveSelector
		Moves the selector based on the thumbstick input.
		And the thumbstick chosen (left or right).
	*/
	moveSelector: function () {
		let old_pos = this.selector.position.clone();
		let target_pos = new THREE.Vector3(this.tx, this.ty, 0);
		let radius = this.data.radius;
		let new_pos = new THREE.Vector3();

		dist = radius;

		switch (this.stick) {
			case "leftHandCollider": // left hand allows for finer control
				target_pos.sub(old_pos);
				new_pos = old_pos.add(target_pos.multiplyScalar(0.1));
				break;

			case "rightHandCollider": // right hand snaps to fixpoints
				for (let i = 0; i < 16; i++) {
					if (i < 8) {
						fixPos = new THREE.Vector3(
							0.5 * radius * 0.9 * Math.cos((i * Math.PI) / 4),
							0.5 * radius * 0.9 * Math.sin((i * Math.PI) / 4),
							0
						);
					} else {
						fixPos = new THREE.Vector3(
							radius * 0.9 * Math.cos((i * Math.PI) / 4),
							radius * 0.9 * Math.sin((i * Math.PI) / 4),
							0
						);
					}
					if (fixPos.distanceTo(target_pos) < dist) {
						dist = fixPos.distanceTo(target_pos);
						new_pos = fixPos;
					}
				}
				break;
		}

		if (new_pos.length() <= 0.9 * this.data.radius) {
			this.selector.position.set(new_pos.x, new_pos.y, new_pos.z);
		}
	},
});

//Section: helper functions
/*function: spawnBlockButton
	Function responsible for creation of control-panel and data-slate buttons.

	Parameters:
		type - the type of button to be spawned (event name to be emitted on press)
		color - string, the color of the button
		pos - array, the position of the button
		dim - array, the dimensions of the button
		parent - the parent entity of the button
		label - the label of the button
	reuturns:
		button - the button entity
*/
function spawnBlockButton(
	type,
	color,
	pos,
	dim,
	parent,
	text_color = "white",
	label = null
) {
	let t = "";
	let button = document.createElement("a-entity");
	button.setAttribute("geometry", {
		primitive: "box",
		width: dim[0],
		height: dim[1],
		depth: dim[2],
	});
	button.setAttribute("material", { color: color });
	button.setAttribute("button", {
		event: type,
		clickEvent: "triggerdown",
		clickable: true,
		raycastable: true,
		springLoaded:
			type == "saveTo" ||
			type == "newGraph" ||
			type == "rename" ||
			type == "genConfFile"
				? true
				: false,
	});

	button.setAttribute("id", "button-" + type);
	button.setAttribute("hoverable", {});

	switch (type) {
		case "saveTo":
			t = "Save";
			wrapCount = t.length + 1;
			break;
		case "togglePM":
			t = label;
			width = 0.18;
			wrapCount = t.length + 5;
			break;

		case "toggleState":
			t = "target/\ncurrent";
			wrapCount = t.length + 5;
			break;
		case "removeGraph":
			t = "Remove";
			wrapCount = t.length + 1;
			break;
		case "newGraph":
			t = "+";
			width = 1;
			wrapCount = t.length + 1;
			break;

		case "rename":
			t = "Rename";
			wrapCount = t.length + 1;
			break;

		case "topMode":
			t = "Top.\nMode";
			wrapCount = 6;
			break;

		case "genConfFile":
			t = "Conf\nFile";
			wrapCount = 6;
			break;

		default:
			t = label;
			wrapCount = t.length + 5;
			break;
	}
	button.setAttribute("text", {
		color: text_color,
		anchor: "center",
		align: "center",
		wrapCount: wrapCount,
		value: t,
		zOffset: dim[2] / 2 + 0.0001,
	});
	button.object3D.position.set(pos[0], pos[1], pos[2]);
	parent.appendChild(button);
	return button;
}
