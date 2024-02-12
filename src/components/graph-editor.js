/* Class: graph-editor-component
	Attaches to a controller and turns it into a graph editor. The graph editor allows the user to spawn vertices and edges, to delete vertices and edges, to relabel vertices and to set the colour and weight of edges. The graph editor is disabled by default and can be enabled by emitting a graphactive event on the document. The graph editor is disabled by emitting a graphinactive event on the document.
*/

//Group: Events
// ----------------------------------------------

/*Event: spawn edge
	Emitted by the conext menu button when the spawn edge button of the vertex context menu is pressed.
	Triggers the edge spawning process. 
	Listener is only set up once the vertex context menu is spawned.

	Detail:

		button - button-component of the button pressed
		name - name of the button pressed
		pushed - boolean indicating whether the button is pushed

	See Also:
	
		<button-component>
		<toggelResponse>
*/

/*Event: relabel vertex
	Emitted by the conext menu button when the relabel vertex button of the vertex context menu is pressed.
	Triggers the vertex relabeling process.
	Listener is only set up once the vertex context menu is spawned.

	Detail:
	
		button - button-component of the button pressed
		name - name of the button pressed
		pushed - boolean indicating whether the button is pushed

	See Also:
	
		<button-component>
		<toggleResponse>
*/

/*Event: delete edge
	Emitted by the conext menu button when the delete edge button of the vertex context menu is pressed.
	Triggers the edge deletion process.
	Listener is only set up once the vertex context menu is spawned.

	Detail:
	
		button - button-component of the button pressed
		name - name of the button pressed
		pushed - boolean indicating whether the button is pushed
	
	See Also:
	
		<button-component>
		<toggelResponse>
*/

AFRAME.registerComponent("graph-editor", {
	// Group: schema and attributes
	// ----------------------------------------------

	/* Property: schema
		Initial parameters of the component.

		Parameters:
		
			vertexSpawner - key to spawn a vertex, defaults to abuttondown
			editKey - key to toggle the edit menu and connect edges, defaults to bbuttondown
	*/
	schema: {
		vertexSpawner: { type: "string", default: "abuttondown" },
		editKey: { type: "string", default: "bbuttondown" },
	},

	/* Property: Attributes
	  	this.activeGraph - container for the graph-component of the active graph
		this.floatingEdge - container for the edge-component of a floating edge	
		this.hoveredEl - container for the vertex-component of the currently hovered vertex
		this.menuVertex - container for the vertex-component of the vertex the menu is currently referring to
		this.collider - container for the collider of the controller
		this.topMode - boolean indicating whether topology mode is enabled
	*/

	// Group: lifecycle-handlers
	// ----------------------------------------------

	/* Constructor: init
		Initialises the component.
		Sets the initial values of the attributes and the event listeners.
	*/
	init: function () {
		this.floatingEdge = undefined;
		this.hoveredEl = null;
		this.menuVertex = null;
		this.collider = document.querySelector("#" + this.el.id + "Sphere");
		this.topMode = false;

		document.addEventListener("graphactive", this.events.enable);
		document.addEventListener("graphinactive", this.events.disable);
		document.addEventListener("topologyModeEnabled", this.events.topModeToggle);
		document.addEventListener(
			"topologyModeDisabled",
			this.events.topModeToggle
		);
	},

	// Group: event-handlers
	events: {
		/*Function: enable
			triggerd by the graphactive event on the document.
			enables the graph editor.
			sets the active graph to the graph of the event.

			Parameters:
				event - graphactive event, needs the graph component of the active graph in event.detail
		*/
		enable: function (event) {
			this.addEventListeners();
			this.activeGraph = event.detail.graph;
		},

		/*Function: disable
			triggerd by the graphinactive event on the document.
			disables the graph editor.
			rsets the active graph to null.
		*/
		disable: function () {
			this.removeEventListeners();
			this.activeGraph = null;
		},

		/*Function: topModeToggle
			triggerd by the topologyModeEnabled and topologyModeDisabled events on the document.
			sets the topMode flag to it's opposite.
			forces a reset of the editor.
		*/
		topModeToggle: function (event) {
			this.events.resetEditor();
			this.topMode = !this.topMode;
		},

		/*Function: resetEditor
			triggerd by the editKey event on the controller. If there is an edit in progress. 
			resets the editor to a pre edit state.
		*/
		resetEditor: function () {
			const menu = this.el.components["controller-menu"];
			const discmenu = this.el.components["disc-menu"];
			console.log("resetting");
			//remove event listeners
			if (menu != undefined) {
				//safety check to ensure there is a menu
				menu.data.subMenus[0].map((button) => {
					this.el.removeEventListener(button, this.events.setEdgeColor);
				});
				menu.data.subMenus[1].map((button) => {
					this.el.removeEventListener(button, this.events.relabelVertex);
				});
				if (menu.data.subMenus.length == 3) {
					//safety check to ensure there is a delete edge button
					menu.data.subMenus[2].map((button) => {
						this.el.removeEventListener(button, this.events.deleteEdge);
					});
				}
				this.el.removeAttribute("controller-menu");
			}

			if (discmenu != undefined) {
				this.el.removeEventListener(
					"weightSelected",
					this.events.setEdgeWeight
				);
				this.el.removeAttribute("disc-menu");
			}
			this.el.removeEventListener("spawn edge", this.events.toggleResponse);
			this.el.removeEventListener("relabel vertex", this.events.toggleResponse);
			this.el.removeEventListener(this.data.editKey, this.events.resetEditor);
			this.menuVertex = null;
			this.el.removeState("hovering");

			//readd vertex spawning
			this.addEventListeners((freshHover = false));
		},

		/*Function:toggleState
			triggerd by the hover-start and hover-end events on the document, if the controller is hovering over a vertex.
			toggles the hovering state of the controller.

			Parameters:
				event - hover-start or hover-end event
		*/
		toggleState: function (event) {
			console.log(event);
			if (
				event.detail.hand == this.el &&
				event.target.hasAttribute("vertex") &&
				event.target.components.vertex.graph == this.activeGraph
			) {
				switch (event.type) {
					case "hover-end":
						this.el.removeState("hovering");
						console.log("not longer hovering");
						this.hoveredEl = null;
						break;

					case "hover-start":
						this.hoveredEl = event.target.components.vertex;
						this.el.addState("hovering");
						console.log("hovering");
						break;
				}
			}
		},

		/*Function:toggleEdgeMode
			triggerd by the stateadded event on the controller.
			toggles editKey response on hovering over a vertex between spawing a context menu on the vertex and connecting edges.
		*/
		toggleEdgeMode: function () {
			if (this.el.is("hovering") && !this.floating) {
				console.log("mode: spawning");
				this.el.removeEventListener(this.data.editKey, this.events.connectEdge);
				this.el.addEventListener(
					this.data.editKey,
					this.events.spawnVertexMenu
				);
			} else {
				if (this.el.is("hovering") && this.floating) {
					console.log("mode: connecting");
					this.el.removeEventListener(
						this.data.editKey,
						this.events.spawnVertexMenu
					);
					this.el.removeEventListener(
						this.data.editKey,
						this.events.resetEditor
					);
					this.el.addEventListener(this.data.editKey, this.events.connectEdge);
				}
			}
		},

		/*Function:disableEdgeMode
			triggerd by the stateremoved events on the controller.
			disables the editKey response upon no longer hovering over a vertex.
		*/
		disableEdgeMode: function () {
			this.el.removeEventListener(
				this.data.editKey,
				this.events.spawnVertexMenu
			);
			this.el.removeEventListener(this.data.editKey, this.events.connectEdge);
		},

		/*Function:toggleVertex
			triggerd by the vertexSpawner event on the controller.
			Spawns a vertex if not hovering over a vertex, removes a vertex if hovering over a vertex.
		*/
		toggleVertex: function () {
			//check if hovering over a vertex
			switch (this.el.is("hovering")) {
				case true: //if hovering over a vertex, remove it
					vertex = this.hoveredEl;
					graph = vertex.graph;
					graph.el.emit("graphedit", {
						type: "vertexRemoval",
						vertex: vertex,
						graph: graph,
					});
					this.el.removeState("hovering");
					this.hoveredEl = null; //manual reset of the hoveredEl
					this.events.resetEditor();
					break;

				case false: //if not hovering over a vertex, spawn a new one
					graph = this.activeGraph;
					const pos = new THREE.Vector3();
					this.collider.object3D.getWorldPosition(pos);
					const newV = {
						id: graph.graphData.graph.vertices.length,
						position: graph.el.object3D.worldToLocal(pos).toArray(),
						geometry: "sphere",
					};

					graph.el.emit("graphedit", {
						type: "vertexAddition",
						vertex: newV,
						graph: graph,
					});
					break;

				default:
					break;
			}
		},

		/*Function:spawnVertexMenu
			triggerd by the editKey event on the controller.
			Spawns a context menu on the hovered vertex.
			Allowing for edge spawning, vertex relabeling and edge deletion.
		*/
		spawnVertexMenu: function (event) {
			//disable unwanted functionality while the menu is active
			this.menuVertex = this.hoveredEl; //remember the vertex menu even if the user stops hovering over it
			this.removeEventListeners((keepHover = true));
			this.el.removeEventListener(
				this.data.editKey,
				this.events.spawnVertexMenu
			);
			this.el.addEventListener(this.data.editKey, this.events.resetEditor);

			let edges = this.menuVertex.data.edges.map((e) =>
				e.getConfig().config.join("-")
			);
			let subMenus = [
				["0", "1", "2", "3", "4", "5", "6"],
				this.menuVertex.graph.graphData.graph.vertices.map((v) => v.data.numId),
			];
			let buttons = ["spawn edge", "relabel vertex"];

			if (edges.length != 0) {
				subMenus.push(edges);
				buttons.push("delete edge");
				this.el.addEventListener("delete edge", this.events.toggleResponse);
			}

			if (this.topMode) {
				// in topology drawing mode edge colouring is disabled
				subMenus[0] = [];
			}

			this.el.setAttribute("controller-menu", {
				buttons: buttons,
				subMenus: subMenus,
				actionKey: "abuttondown",
				spawnKey: "bbuttondown",
			});
			this.el.emit("spawnkeypressed", { name: "main" }); //spawn the menu

			//response listeners setting functionality upon spawn of the submenu
			this.el.addEventListener("spawn edge", this.events.toggleResponse);
			this.el.addEventListener("relabel vertex", this.events.toggleResponse);
		},

		/*Function:toggleResponse
			triggerd by the spawn edge, relabel vertex and delete edge events on the controller, emitted by buttons of the Vertex Context menu.
			Sets the response to presses of keys in the submenus.
		*/
		toggleResponse: function (event) {
			const edgeColor = this.topMode ? 99 : undefined; // 99 serves as key for black edges in topology mode
			let menu = this.el.components["controller-menu"];

			switch (event.detail.name) {
				case "spawn edge":
					subMenu = menu.data.subMenus[0];
					handler = this.events.setEdgeColor;

					// initialise the floating edge entity
					const edgeEl = document.createElement("a-entity");

					edgeEl.setAttribute("id", "floatingEdge");
					edgeEl.addState("floating");

					this.el.sceneEl.appendChild(edgeEl);
					this.floatingEdge = {
						graph: "#" + this.activeGraph.el.id,
						numId: 0,
						edgeConfig: [
							this.menuVertex.data.numId,
							"floating",
							edgeColor,
							edgeColor,
						],
						weight: 1,
						phase: 0,
					};

					if (this.topMode) {
						// in topology drawing mode no weights or colours need to be defines so the edge can be directly spawned
						this.spawnFloatingEdge(this.floatingEdge).then(() => {
							this.floating = true;
							this.floatingEdge.endsGrabbed = true;
							this.events.resetEditor();
						});
					}

					break;

				case "relabel vertex":
					subMenu = menu.data.subMenus[1];
					handler = this.events.relabelVertex;
					break;

				case "delete edge":
					subMenu = menu.data.subMenus[2];
					handler = this.events.deleteEdge;
					break;
			}

			// add listeners for further edge processing
			subMenu.forEach((button) => {
				this.el.addEventListener(button, handler);
			});
		},

		/*Function:deleteEdge
			Handler for edge removal, removes an edge from the graph.
			Finishes an edit cycle by resetting the editor.
		*/
		deleteEdge: function (event) {
			console.log(event);
			const edge = this.menuVertex.data.edges.filter(
				(e) => e.getConfig().config.join("-") == event.detail.name
			)[0];
			console.log(edge);
			this.menuVertex.graph.el.emit("graphedit", {
				type: "edgeRemoval",
				edge: edge,
				graph: this.menuVertex.graph,
			});
			this.events.resetEditor();
		},

		/*Function:relabelVertex
			Handler for vertex relabeling, relabels a vertex.
			Finishes an edit cycle by resetting the editor.
		*/
		relabelVertex: function (event) {
			const graph = this.activeGraph;
			const vertex = this.menuVertex;
			const oldLabel = vertex.data.numId;
			const newLabel = event.detail.name;
			const oldVertex = document.querySelector(
				`#graph-${graph.data.name}-vertex${newLabel}`
			).components.vertex;

			//swap labels

			vertex.data.numId = Number.parseInt(newLabel);
			oldVertex.data.numId = Number.parseInt(oldLabel);

			//update vertices
			vertex.update(vertex.oldData);
			oldVertex.update(oldVertex.oldData);

			//this update is done by hand instead of with setAttribute as
			//setAttribute tries to serialise the entire data object which breaks due to circular serialisation
			//reset the editor
			this.events.resetEditor();
		},

		/*Function:setEdgeColor
			Handler for edge colouring, sets the colour of an edge.
			progresses the edit cycle by spawining the edge weight menu.
		*/
		setEdgeColor: function (event) {
			if (this.floatingEdge.edgeConfig[2] == undefined) {
				//if the edge has no colour yet
				this.floatingEdge.edgeConfig[2] = Number.parseInt(event.detail.name);
			} else {
				// if the edge already has one colour chosen

				this.floatingEdge.edgeConfig[3] = Number.parseInt(event.detail.name);
				//TODO: disable the colour menu, write some proper disabling code for the menu in the menu component
				this.el.setAttribute("disc-menu", {});
				this.el.addEventListener("weightSelected", this.events.setEdgeWeight);

				const menu = this.el.components["controller-menu"];
				console.log("resetting");
				//remove event listeners
				if (menu != undefined) {
					//safety check to ensure there is a menu
					menu.data.subMenus[0].map((button) => {
						this.el.removeEventListener(button, this.events.setEdgeColor);
					});
					menu.data.subMenus[1].map((button) => {
						this.el.removeEventListener(button, this.events.relabelVertex);
					});
					if (menu.data.subMenus.length == 3) {
						//safety check to ensure there is a delete edge button
						menu.data.subMenus[2].map((button) => {
							this.el.removeEventListener(button, this.events.deleteEdge);
						});
					}
					this.el.removeAttribute("controller-menu");
				}
			}
		},

		/*Function:setEdgeWeight
			Handler for edge weight setting, sets the weight of an edge.
			progresses the edit cycle by spawning the edge and resetting the editor.
		*/
		setEdgeWeight: function (event) {
			this.floatingEdge.amplitude = event.detail.amplitude;
			this.floatingEdge.phase = event.detail.phase;
			this.spawnFloatingEdge(this.floatingEdge).then(() => {
				this.floating = true;
				this.floatingEdge.endsGrabbed = true;
				this.events.resetEditor();
			});
		},

		/*Function:connectEdge
			triggerd by the editKey event on the controller.
			Connects an edge to a vertex if hovering over a vertex
			Finishes an edit cycle.
		*/
		connectEdge: function () {
			if (this.el.is("hovering")) {
				this.el.removeEventListener(this.data.editKey, this.events.connectEdge);

				const endVertex = this.hoveredEl;
				const edge = this.floatingEdge;

				graph = this.activeGraph;

				edge.data.edgeConfig[1] = endVertex;

				graph.el.emit("graphedit", {
					graph: graph,
					type: "edgeAddition",
					edge: edge.data,
				});

				this.el.sceneEl.removeChild(edge.el);
				edge.el.destroy();
				this.floatingEdge = null;

				this.floating = false;
			}
		},
	},

	// Group: methods
	// ----------------------------------------------

	/*Method: spawnFloatingEdge
		spawns an edge from an edge data object. Creates a temporary edge entity for the floating edge

		Parameters:
			edge - edge data object

		Returns:
			Promise - resolves when the edge is spawned
	*/
	spawnFloatingEdge: function (edge) {
		const graph = this.menuVertex.graph;
		const edgeEl = document.querySelector("#floatingEdge");
		edgeEl.setAttribute("edge", {
			graph: "#" + graph.el.id,
			numId: edge.numId,
			edgeConfig: edge.edgeConfig,
			amplitude: edge.amplitude,
			phase: edge.phase,
		});

		this.floatingEdge = edgeEl.components.edge;
		this.el.removeEventListener(this.data.editKey, this.events.spawnVertexMenu);
		return new Promise((resolve) => {
			resolve();
		});
	},

	/*Method: addEventListeners
		adds the basic event listeners to the controller. Does not handle listeners for the vertex context menu.

		Parameters:
			freshHover - boolean indicating whether the hover listeners should be added
	*/
	addEventListeners: function (freshHover = true) {
		this.el.addEventListener(this.data.vertexSpawner, this.events.toggleVertex);

		if (freshHover) {
			document.addEventListener("hover-start", this.events.toggleState);
			document.addEventListener("hover-end", this.events.toggleState);
		}
		this.el.addEventListener("stateadded", this.events.toggleEdgeMode);
		this.el.addEventListener("stateremoved", this.events.disableEdgeMode);
	},

	/*Method: removeEventListeners
		removes the basic event listeners from the controller. Does not handle listeners for the vertex context menu.

		Parameters:
			keepHover - boolean indicating whether the hover listeners should be kept.
	*/
	removeEventListeners: function (keepHover = false) {
		this.el.removeEventListener(
			this.data.vertexSpawner,
			this.events.toggleVertex
		);

		if (!keepHover) {
			document.removeEventListener("hover-start", this.events.toggleState);
			document.removeEventListener("hover-end", this.events.toggleState);
		}
		this.el.removeEventListener("stateadded", this.events.toggleEdgeMode);
		this.el.removeEventListener("stateremoved", this.events.disableEdgeMode);
	},
});
