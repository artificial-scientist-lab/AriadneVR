var globalConfig;
fetch("./src/globalConfig.json")
	.then((response) => response.json())
	.then((json) => {
		globalConfig = json;
	});
var configTemplate;
fetch("./src/configTemplate.json")
	.then((response) => response.json())
	.then((json) => {
		configTemplate = json;
	});

/*Class: graph-component
	Turns an element into a graph. Contains the graph data and controls graph updates due to edits.

	Listeners:
		graphedit - updateGraph: updates the graph due to edits
		graphbuilt - onPMBuilt:
		grab-end - updateCollisionMesh:  updates the collision mesh of the graph

	Events:
		graphbuilt - emitted on graph built: 
		pmdecomposed - emitted on pm decomposition: 
		pmremoved - emitted on pm removal: 
		PMSUpdated - emitted on pm update: 
*/
AFRAME.registerComponent("graph", {
	/*Property: schema
		Intial parameters of the component.

		Parameters:
		
			name - name of the graph
			graphData - graph data of the graph in serialized JSON format
			history - history of the graph in serialized JSON format if available

	*/
	schema: {
		name: { type: "string", default: "graph" },
		graphData: { type: "string" },
		history: { type: "string", default: "../graphJSON/ex1.json" },
	},

	/* Property: Attributes
	  	this.graphData - parsed graph data of the graph, set by init()
		this.PMs - perfect matchings of the graph, set by findPMs()
		this.currentStateStrings - ket strings of the graph, set by findPMs()
		this.currentStateWeights - ket weights of the graph, set by findPMs()
		this.floatingEdge - container for potential floating edges during edits
	*/

	// Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Sets the text label, the geometry and the physics of the vertex and the Listeners.
	*/
	init: function () {
		this.floatingEdge = undefined;
		this.graphData = JSON.parse(this.data.graphData);
		this.setText();
		this.el.addEventListener("graphedit", this.events.updateGraph);
		this.el.addEventListener("graphbuilt", this.events.onPMBuilt);
		this.el.addEventListener("grab-end", this.events.updateCollisionMesh);
		this.build(); //build the graph from the graphData
	},

	/*Function: update
		Updates the component when the data changes. Only triggers on changes of the name.
		Graph edits are handled by the graphedit event listener.

		Parameters:
			oldData - old data of the component accessible through this.oldData
	*/
	update: function (oldData) {
		if (this.data.name != oldData.name) {
			const oldName = oldData.name;
			const button = document.querySelector(`#button-${oldName}`);
			const dataslate = document.querySelector(`#data-slate-${oldName}`);

			if (button != undefined) {
				button.components["button"].data.label = this.data.name;
				button.components["button"].update(button.components["button"].oldData);
				button.setAttribute("id", "button-" + this.data.name);
			}

			if (dataslate != undefined) {
				dataslate.setAttribute("id", "data-slate-" + this.data.name);
			}

			this.setText();
			this.el.setAttribute("id", "graph-" + this.data.name);
			this.oldData.name = this.data.name.slice(); //manual update of oldData
		}
	},

	/*Function: remove
		Callled on graph removal.
		Removes the event listeners.
		Geometries are cleaned up by the vertex and edge components.
	*/
	remove: function () {
		this.graphData.graph.vertices.forEach((v) => {
			this.el.removeChild(v.el);
		});
		this.el.removeEventListener("graphedit", this.events.updateGraph);
		this.el.removeEventListener("graphbuilt", this.events.onPMBuilt);
		this.el.removeEventListener("grab-end", this.events.updateCollisionMesh);
		cleanUpObject(this.el.object3D);
		this.el.destroy();
	},

	// Group: event-handlers
	// ----------------------------------------------

	events: {
		/*Function: updateCollisionMesh
			Updates the collision mesh of the graph by removing and readding the dynamic-body component.
			Triggers on grab-end events within or on this entity.
		*/
		updateCollisionMesh: function () {
			console.log("snyced");
			this.el.removeAttribute("dynamic-body"); //hacky way to force the physics engine to update the collision mesh
			this.el.setAttribute("dynamic-body", { shape: "box", mass: 100 });
		},

		/*Function: updateGraph
			Updates the graph due to edits.
			Manually triggers the update of the collision mesh.

			Parameters:
				event - the event object containing the type of edit and related information

			Edit types:
				vertexRemoval - vertex was removed
				vertexAddition - vertex was added
				edgeRemoval - edge was removed
				edgeAddition - edge was added
			
			
		*/
		updateGraph: function (event) {
			if (event.detail.graph.el == this.el) {
				//check what changed
				switch (event.detail.type) {
					case "vertexRemoval":
						//remove vertex
						//remove all edges connected to this vertex
						event.detail.vertex.data.edges.forEach((e) => {
							this.removeEdge(e);
						});
						this.removeVertex(event.detail.vertex);
						break;

					case "vertexAddition":
						this.addVertex(event.detail.vertex);
						break;

					case "edgeRemoval":
						this.removeEdge(event.detail.edge);
						break;

					case "edgeAddition":
						this.addEdge(event.detail.edge);
						break;

					default:
						break;
				}

				this.events.updateCollisionMesh();
			}
		},
	},

	// Group: Methods
	// ----------------------------------------------

	/*Method: spawnPM
		Spawns a perfect matching as a new scene element.

		Parameters:
			pmIndex - index of the perfect matching in the PM array
	*/
	spawnPM: function (pmIndex) {
		pm = this.PMs[pmIndex];
		let pmEl = document.createElement("a-entity");
		let pmObj = pm.map(
			(edgeConfig) =>
				this.graphData.graph.edges.filter((e) =>
					arraysEqual(
						e.data.edgeConfig.map((c) =>
							Number.isInteger(c) ? c : c.data.numId
						),
						edgeConfig
					)
				)[0]
		);
		pmEl.setAttribute("ispm", true);
		pmEl.setAttribute("pmid", pmIndex);
		pmEl.setAttribute("id", this.el.id + "-PM" + pmIndex);
		pmEl.setAttribute("pm", { graph: this.el, pmConfig: pm });
		pmEl.components.pm.pmConfig = pmObj;
		this.el.sceneEl.appendChild(pmEl);
		pmEl.setAttribute("grabbable", {
			startButtons: "gripdown",
			endButtons: "gripup",
		});

		this.el.emit("pmdecomposed", { graph: this.el });
	},

	/*Method: removePM
		Removes a perfect matching from the scene.
		emits the "pmremoved" event.

		Parameters:
			pmIndex - index of the perfect matching in the PM array
	*/
	removePM: function (pmIndex) {
		pm = document.querySelector("#" + this.el.id + "-PM" + pmIndex);
		if (pm != null) {
			this.el.sceneEl.removeChild(pm);
		}

		this.el.emit("pmremoved", { graph: this.el }, true);
	},

	/*Method: save
		Saves the graph data to a file and initiates the download.
	*/
	save: function () {
		//copy the current objects
		const vertices = [...this.graphData.graph.vertices];
		const edges = [...this.graphData.graph.edges];

		//turn objects in serializable data
		this.graphData.graph.vertices = this.graphData.graph.vertices.map((v) =>
			v.getConfig()
		);
		this.graphData.graph.edges = this.graphData.graph.edges.map((e) =>
			e.getConfig()
		);

		const jsonstring = JSON.stringify(this.graphData);
		download(jsonstring, this.data.name + ".json", "text/plain");
		this.graphData.graph.vertices = vertices;
		this.graphData.graph.edges = edges;
	},

	/*Method: setText
		Sets the text label of the graph.
	*/
	setText: function () {
		this.el.setAttribute("text", {
			width: 0.19,
			height: 0.09,
			anchor: "center",
			align: "center",
			value: this.data.name,
			color: "#000000",
			zOffset: 0.01,
		});
	},

	/*Method: updateObjectContainers
		Replaces the data entries by pointers to the actual objects.
		Is called after the graph is built.

		Returns:
			Promise - resolves when the object containers are updated
	*/
	updateObjectContainers: function () {
		// replace the data entries by actual objects
		// this is done here because at this point it is guaranteed all objects exist
		this.graphData.graph.vertices.forEach((v) => {
			v.data.neighbours = this.graphData.graph.vertices.filter((v2) =>
				v.data.neighbours.includes(v2.data.numId)
			);
			v.data.edges = this.graphData.graph.edges.filter((e) =>
				e.data.edgeConfig.slice(0, 2).includes(v)
			);
		});

		this.el.emit("graphbuilt", { graph: this.el }, true);
		this.findPMs();

		return new Promise((resolve) => resolve());
	},

	/*Method: drawEdge
		Draws an edge between two vertices.

		Parameters:
			e - the edge component
			collider - multipurpose parameter, can be empty, the collider used during drawing or "skipSiblingCheck" to skip the sibling check
	*/
	drawEdge: function (e, collider = undefined) {
		if (collider != undefined && collider != "skipSiblingCheck") {
			e.updateConfig(collider);
		}
		if (collider != "skipSiblingCheck") {
			e.checkForSiblings();
		}
		e.update(e.data);
		e.drawEdge(true);
	},

	/*Method: build
		Builds the graph from the graph data. Creates all vertex and edge objects, sets up the physics and positions the graph on the right hand.
	*/
	build: function () {
		this.buildVertices() //create all vertex entities
			.then(() => this.buildEdges()) //create all edge objects
			.then(() => this.updateObjectContainers()) // replace the respective data-object entries by actual objects
			.then(() => {
				//set up the physics, dependent on the shape hence why it is done here and not in init
				this.el.setAttribute("dynamic-body", { shape: "box", mass: 100 });
				this.el.setAttribute("sleepy", {
					linearDamping: 0.9,
					angularDamping: 0.9,
				});
				this.el.setAttribute("collision-filter", {
					group: "graph",
					collidesWith: ["default", "hands"],
				});
			});
		// position the graph on the right hand
		colliderPos = new THREE.Vector3();
		document
			.querySelector("#rightHandCollider")
			.object3D.getWorldPosition(colliderPos);
		colliderPos = colliderPos.toArray();
		this.el.object3D.position.set(
			colliderPos[0],
			colliderPos[1],
			colliderPos[2]
		);
	},

	/*Method: buildVertices
		Creates all vertex entities.
		Is called by build().

		Returns:
			Promise - resolves when all vertex entities are created
	*/
	buildVertices: function () {
		this.graphData.graph.vertices = this.graphData.graph.vertices.map(
			(vertex) => {
				if (vertex.el == undefined) {
					// only build the vertex if it does not exist yet
					const v = document.createElement("a-entity");
					this.el.appendChild(v);
					v.setAttribute("vertex", {
						graph: "#" + this.el.id,
						numId: vertex.id,
						color: globalConfig.vColor,
						position: vertex.position,
						geometry: vertex.geometry,
						edges: vertex.edges,
						neighbours: vertex.neighbours,
					});
					return v.components.vertex;
				} else {
					return vertex;
				}
			}
		);
		return new Promise((resolve) => resolve());
	},

	/*Method: buildEdges
		Creates all edge entities.
		Is called by build().
		Replaces the data entries by pointers to the actual objects.
	
		Returns:
			Promise - resolves when all edge entities are created
	*/
	buildEdges: function () {
		this.graphData.graph.edges = this.graphData.graph.edges.map((edge) => {
			this.el.setAttribute(`edge__${edge.id}`, {
				graph: "#" + this.el.id,
				numId: edge.id,
				edgeConfig: edge.config,
				siblingConfig: edge.siblingConfig,
				amplitude: edge.amplitude,
				phase: edge.phase,
			});
			return this.el.components[`edge__${edge.id}`];
		});
		return new Promise((resolve) => resolve());
	},

	/*Method: removeVertex
		Removes a vertex from the graph.
		Removes the vertex entity from the scene.
		Updates the PMs and emits the "PMSUpdated" event.

		Parameters:
			vertex - the vertex component
	*/

	removeVertex: function (vertex) {
		this.el.removeChild(vertex.el);
		vertex.el.destroy();
		this.findPMs();
		this.el.emit("PMSUpdated", { graph: this });
	},

	/*Method: addVertex
		Adds a vertex to the graph.
		Attaches the vertex object3D to the graph entity.
		Updates the PMs and emits the "PMSUpdated" event.

		Parameters:
			vertex - the vertex component
	*/
	addVertex: function (vertex) {
		this.graphData.graph.vertices.push(vertex);
		this.buildVertices().then(() => {
			this.findPMs();
			this.el.emit("PMSUpdated", { graph: this });
		});
	},

	/*Method: removeEdge
		Removes an edge from the graph.
		Updates the PMs and emits the "PMSUpdated" event.

		Parameters:
			edge - the edge component
	*/
	removeEdge: function (edge) {
		//remove the edge from the graph which also removes it from the scene
		this.el.removeAttribute(`${edge.attrName}`);
		this.findPMs();
		this.el.emit("PMsUpdated", { graph: this });
	},

	/*Method: addEdge
		Adds an edge to the graph.
		Updates sibling configurations of all edges.
		Updates the graphData
		Updates the PMs and emits the "PMSUpdated" event.
	*/
	addEdge: function (edgeData) {
		//get edge argument Id

		// it is impossible to dynamically update edge argument IDs, hence they don't match numIDs necessarily
		// new edges hence use the new largest ID which can be larger than the amound of current edges
		// the largest numID
		const a = this.el.attributes;
		const edgeArgID =
			this.graphData.graph.edges.length == 0
				? 0 // if there are no edges, the first edge has ID 0
				: Math.max(
						...Object.values(this.el.attributes)
							.filter((attr) => attr.name.startsWith("edge"))
							.map((attr) => Number.parseInt(attr.name.match(/(\d+)/)[0])) //search for the first number in the name
				  ) + 1;

		// check for siblings
		let siblingConfig = [0, 0, []];
		let startVertex = edgeData.edgeConfig[0];

		for (let i = 0; i < startVertex.data.edges.length; i++) {
			let potentialSibling = startVertex.data.edges[i];
			if (
				potentialSibling.data.edgeConfig
					.slice(0, 2)
					.includes(edgeData.edgeConfig[1]) &&
				potentialSibling.data.edgeConfig
					.slice(0, 2)
					.includes(edgeData.edgeConfig[0])
			) {
				// found a sibling
				siblingConfig[0] += 1;
				siblingConfig[2].push(potentialSibling.id);

				potentialSibling.data.siblingConfig[0] += 1;
				potentialSibling.data.siblingConfig[2].push(`edge__${edgeArgID}`);
				potentialSibling.update(potentialSibling.oldData);
			}
			siblingConfig[1] = siblingConfig[0]; //sibling index is the last of the set == sibling count
		}

		// create the edge component
		this.el.setAttribute("edge__" + edgeArgID, {
			graph: "#" + this.el.id,
			numId: this.graphData.graph.edges.length,
			edgeConfig: edgeData.edgeConfig.map((c) =>
				Number.isInteger(c) ? c : c.data.numId
			),
			siblingConfig: siblingConfig,
			amplitude: edgeData.amplitude,
			phase: edgeData.phase,
		});

		edge = this.el.components[`edge__${edgeArgID}`]; //get the edge component

		this.graphData.graph.edges.push(edge);
		//update the vertex relations
		this.graphData.graph.vertices.forEach((v) => {
			if (edge.data.edgeConfig.includes(v)) {
				v.data.edges.push(edge);
				v == edge.data.edgeConfig[0]
					? v.data.neighbours.push(edge.data.edgeConfig[1])
					: v.data.neighbours.push(edge.data.edgeConfig[0]);
			}
		});
		this.findPMs();
		this.el.emit("PMsUpdated", { graph: this });
	},

	/*Method: findPMs
		Finds all perfect matchings of the graph.
		Updates the PMs, the ket strings and the ket weights.
	*/
	findPMs: function () {
		edgeConfig = this.graphData.graph.edges.map((e) =>
			e.data.edgeConfig.map((c) => (Number.isInteger(c) ? c : c.data.numId))
		);

		if (edgeConfig.length == 0) {
			this.PMs = [];
		} else {
			this.PMs = findPerfectMatchings(edgeConfig);
		}

		this.getKetStrings();
		this.getKetWeights();
	},

	/*Method: getKetStrings
		Calculates the ket strings of the graph.
	*/
	getKetStrings: function () {
		this.currentStateStrings = this.PMs.map((pm) => {
			ket = "|";
			//make sure the vertices are sorted by their numId
			vertices = this.graphData.graph.vertices.sort(
				(a, b) => a.data.numId - b.data.numId
			);

			this.graphData.graph.vertices.forEach((v) => {
				state = pm
					.filter((e) => e[0] == v.data.numId || e[1] == v.data.numId)
					.map((e) => (e[0] == v.data.numId ? e[2] : e[3]));
				ket += String(state);
			});
			ket += ">";

			return ket;
		});

		this.currentStateStrings =
			this.currentStateStrings == undefined ? [] : this.currentStateStrings;
	},

	/*Method: getKetWeights
		Calculates the ket weights of the graph.
	*/
	getKetWeights: function () {
		this.currentStateWeights = this.PMs.map((pm) => {
			weight = math.complex(1, 0);
			pm.forEach((e) => {
				edgeComp = this.graphData.graph.edges.filter((edge) =>
					arraysEqual(edge.getConfig().config, e)
				)[0];

				weight = math.multiply(
					weight,
					new math.Complex.fromPolar(
						edgeComp.data.amplitude,
						edgeComp.data.phase * Math.PI
					)
				); //phase in units of pi
			});
			return weight.format(2);
		});
		this.currentStateWeights =
			this.currentStateWeights == undefined ? [] : this.currentStateWeights;
	},
});
