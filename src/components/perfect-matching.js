/*Class: pm-component

	Component for perfect matchings, creates a subgraph object from a graph object and adds physics to it.
	Perfect matching vertices are not interactable but update upon interaction with graph vertices.

*/

AFRAME.registerComponent("pm", {
	// Group: schema and attributes
	// ----------------------------------------------
	/*Property: schema

		Parameters:
			graph - graph-selector
			pmConfig - array of edges of the perfect matching
	*/
	schema: {
		graph: { type: "selector" },
		pmConfig: { type: "array", default: [] },
	},

	/* Property: Attributes
		this.graph - graph-component of the parent graph, set by init()
		this.edges - edges of the perfect matching, set by init()
		this.vertices - vertices of the perfect matching, set by init()
		this.updatingVertex - vertex that is currently being updated, set by toggleVertexUpdate()
		this.ket - ket of the perfect matching, set by setLabel()
		this.weight - weight of the perfect matching, set by setLabel()
		this.pmConfig - array of edges of the perfect matching, set by the graph component
	*/

	// Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Sets the graph, the edges and the vertices of the perfect matching and the Listeners.
	*/
	init: function () {
		console.log("initialising PM");
		this.graph = this.data.graph.components.graph;

		this.edges = [];
		this.vertices = [];
		this.updateRequired = true;

		this.shiftingSpeed = 0;
		document.addEventListener(
			"vertexgrabstart",
			this.events.toggleVertexUpdate
		);
		document.addEventListener("vertexgrabend", this.events.toggleVertexUpdate);
	},

	remove: function () {
		document.removeEventListener(
			"vertexgrabstart",
			this.events.toggleVertexUpdate
		);
		document.removeEventListener(
			"vertexgrabend",
			this.events.toggleVertexUpdate
		);
		cleanUpObject(this.el.object3D);
		this.el.destroy();
	},

	/*Function: update	
		Update-handler
		Builds the subgraph object and adds physics to it.
	*/
	update: function () {
		this.build();
		this.el.setAttribute("dynamic-body", { shape: "box", mass: 100 });
		this.el.setAttribute("sleepy", { linearDamping: 0.9, angularDamping: 0.9 });
		this.el.setAttribute("collision-filter", {
			group: "graph",
			collidesWith: ["default", "hands"],
		});
		this.updatingVertex = undefined;
	},

	/*Function: tick
		tick-handler
		Updates the position of the vertices and the indicators if a vertex is being moved
	*/
	tick: function () {
		if (this.updatingVertex != undefined) {
			let vPos = this.graph.el.object3D.getObjectByName(
				this.updatingVertex.name
			).position;
			this.updatingVertex.position.set(vPos.x, vPos.y, vPos.z);
			const edgeObjs = this.el.object3DMap.mesh.children;
			for (let i = 0; i < edgeObjs.length; i++) {
				//this loop updates every indicator position, hence comes with overhead since only one indicator can be moved at time
				const edgeObj = edgeObjs[i];
				const indicator = edgeObj.getObjectByName("indicator");
				if (indicator != undefined) {
					const inPos = this.graph.el.object3D
						.getObjectByName(edgeObj.name)
						.getObjectByName("indicator").position;
					indicator.position.set(inPos.x, inPos.y, inPos.z);
				}
			}
		}
	},

	// Group: event-handlers
	// ----------------------------------------------

	events: {
		/*Function: toggleVertexUpdate
			Toggles the this.updatingVertex attribute.
			Sets this.updatingVertex to the vertex that is currently being moved.
			Causes the tick handler to update the position of the vertex.
			Listens both to *vertexgrabstart* and *vertexgrabend* events.

			Parameters:
				event - the event object deliverd by the <vertex-component>

			See Also:
				<vertex-component>

		*/
		toggleVertexUpdate: function (event) {
			vertexName = event.detail.vertex;

			switch (event.type) {
				case "vertexgrabstart":
					this.updatingVertex = this.el.object3D.getObjectByName(vertexName);
					break;

				case "vertexgrabend":
					this.updatingVertex = undefined;
					break;
			}
		},
	},

	// Group: methods
	// ----------------------------------------------

	/*Method: build
		Builds the subgraph object from the graph object and adds it to the scene.
	*/
	build: function () {
		names = this.pmConfig.map((e) => "edge" + e.data.numId);

		this.graph.graphData.graph.vertices.forEach((vertex) => {
			v = vertex.el.object3D.clone();
			this.el.object3D.add(v);
			this.vertices.push(v);
		});

		edges = new THREE.Object3D();
		this.graph.el.object3D.children.map((e) => {
			if (names.includes(e.name)) {
				edges.add(e.clone());
			}
		});
		this.el.setObject3D("mesh", edges);

		GraphPos = new THREE.Vector3();
		this.graph.el.object3D.getWorldPosition(GraphPos);
		GraphPos = GraphPos.toArray();
		this.el.object3D.position.set(GraphPos[0], GraphPos[1], GraphPos[2]);
		this.el.object3D.translateY(
			Math.sin(((2 * Math.PI) / 10) * this.el.getAttribute("pmid")) * 0.3
		);
		this.el.object3D.translateX(
			Math.cos(((2 * Math.PI) / 10) * this.el.getAttribute("pmid")) * 0.3
		);
		this.setLabel();
	},

	/*Method: setLabel
		Sets the label of the perfect matching.
		weight x ket
	*/
	setLabel: function () {
		this.ket = this.graph.currentStateStrings[this.el.getAttribute("pmid")];
		this.weight = this.graph.currentStateWeights[this.el.getAttribute("pmid")];
		this.el.setAttribute("text", {
			width: 0.19,
			height: 0.09,
			anchor: "center",
			align: "center",
			value: this.weight + " x " + this.ket,
			color: "#000000",
			zOffset: 0.01,
		});
	},
});
