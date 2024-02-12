// globally available geometry variables. to be replaced with instanced geometries
var vmat = new THREE.MeshLambertMaterial({ color: "#000000" });
var vSphereGeo = new THREE.OctahedronGeometry(0.004, 1);
var vTetraGeo = new THREE.TetrahedronGeometry(0.005, 0);
var vBoxGeo = new THREE.BoxGeometry(0.005, 0.005, 0.005);

//## COMPONENT ##

/* Class: vertex-component
	Turns an element into a vertex of a graph. Vertices are grabbable and hoverable. They have a text label and a geometry. They are connected to edges and other vertices. They react dynamically to updates of the graph data.

	Dependencies: 
		graph-component - requires a parent element with a graph-component
	

*/
// Group: Events:
// ----------------------------------------------

/*Event: vertexgrabstart
	Emitted on grab start events.
	Tells pm vertices to update their positions.

	Detail:

		vertex - name of the vertex (this.el.object3D.name)

	See Also:

		<pm-component>
*/

/*Event: vertexgrabend
	Emitted on grab end events.
	Tells pm vertices to stop updating their positions.

	Detail:

		vertex - name of the vertex (this.el.object3D.name)

	See Also:

		<pm-component>
*/
AFRAME.registerComponent("vertex", {
	// Group: schema and attributes
	// ----------------------------------------------
	/*Property: schema
		Intial parameters of the component.

		Parameters:
		
			graph - graph-selector
			numId - numerical id of the vertex
			color - color of the vertex
			position - position of the vertex
			geometry - geometry of the vertex
			edges - edges of the vertex
			neighbours - neighbours of the vertex

	*/
	schema: {
		graph: { type: "selector" },
		numId: { type: "number" },
		color: { type: "string" },
		position: { type: "array" },
		geometry: { type: "string" },
		edges: { type: "array" },
		neighbours: { type: "array" },
	},

	/* Property: Attributes
	  	this.graph - graph-component of the parent graph, set by init()
		this.mesh - mesh of the vertex, set by init() through getGeometry()
	*/

	// Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Sets the text label, the geometry and the physics of the vertex and the Listeners.
	*/
	init: function () {
		this.setText();
		this.graph = this.data.graph.components.graph;
		this.el.setAttribute("isVertex", true);
		this.el.setAttribute("grabbable", {
			startButtons: "triggerdown",
			endButtons: "triggerup",
			usePhysics: "ifavailable",
		});
		this.el.setAttribute("hoverable", {});
		this.el.setObject3D("mesh", this.getGeometry());
		this.el.setAttribute("dynamic-body", { shape: "box", mass: 1 });
		this.el.setAttribute("collision-filter", {
			group: "vertex",
			collidesWith: ["default", "hands"],
		});

		this.el.setAttribute("sleepy", {
			linearDamping: 0.99,
			delay: 0.1,
			angularDamping: 0.99,
		});

		this.el.object3D.position.set(
			this.data.position[0],
			this.data.position[1],
			this.data.position[2]
		);

		this.el.addEventListener("stateadded", this.events.onGrabStart);
		this.el.addEventListener("stateremoved", this.events.onGrabEnd);
	},

	/*Function: update
		update-handler
		Updates the component when the graph data changes.
		Updates the id, numerical id, the color, the geometry and the edges of the vertex.

		Parameters:
			oldData - the old data of the component accesible through this.oldData

	*/
	update(oldData) {
		this.el.setAttribute(
			"id",
			this.data.graph.id + "-vertex" + this.data.numId
		);
		this.setText(); // old data lacks behind one change, meaning if you change vertex labels back and forth between two labels the label would not be redrawn if this is in an if statement

		if (oldData.graph != this.data.graph) {
			if (typeof this.data.graph == "string") {
				console.log("is string");
				this.data.graph = document.querySelector(this.data.graph);
				console.log(this.data.graph);
			}
			this.el.setAttribute(
				"id",
				this.data.graph.id + "-vertex" + this.data.numId
			);
			this.graph = this.data.graph.components.graph;
		}

		if (oldData.color != this.data.color) {
			this.mat.color.set(this.data.color);
		}
		if (oldData.geometry != this.data.geometry) {
			this.el.setObject3D("mesh", this.getGeometry());
		}
	},

	/*Function: remove
		remove-handler, executed when the component is removed.
		Removes the vertex from the graph data and cleans up the 3d object.
	*/
	remove() {
		const graphData = this.graph.graphData;
		cleanUpObject(this.el.object3D);
		graphData.graph.vertices = graphData.graph.vertices.filter(
			(v) => v != this
		);
		graphData.graph.vertices.forEach((v) => {
			v.data.neighbours = v.data.neighbours.filter((n) => n != this);
			if (v.data.numId > this.data.numId) {
				v.data.numId -= 1;
			}
			v.update(v.oldData);
		});
		this.el.destroy();
	},

	/*Function: tick
		tick-handler, executed every frame.
		removes physics behaviour when the graph is grabbed.
	*/
	tick: function () {
		//// this is a dirty trick to stop the vertices of floating away when the graph is grabbed. There must be a better way to do this
		if (this.el.parentNode.is("grabbed")) {
			// this.el.components['dynamic-body'].syncToPhysics()} //without this the vertex doesn't move along the graph
			if (this.el.hasAttribute("dynamic-body")) {
				console.log("removing dynamic body");
				this.el.removeAttribute("dynamic-body");
			}
		} else if (!this.el.hasAttribute("dynamic-body")) {
			this.el.setAttribute("dynamic-body", { shape: "box", mass: 1 }); //TODO: causes an error with yet no consequences, find a better way to pause this
		}
	},

	//Group: event-handlers
	// ----------------------------------------------

	events: {
		/*Function: onGrabStart
			
				listens to *stateadded* events on this element.
				only triggers on the *grabbed* state.
				Sets edges and potential pm-verticex-clones to start updating their positions.
				Emits a <vertexgrabstart> event.

				Parameters: 
				
					event - the event object of stateaddded

				See Also:

					<vertexgrabstart>
					<onGrabEnd>
					<pm-component>
		*/
		onGrabStart: function (event) {
			if (event.detail == "grabbed") {
				this.el.emit("vertexgrabstart", { vertex: this.el.object3D.name }); //pms are listening if they should update their positions
				this.data.edges.forEach((edge) => {
					edge.endsGrabbed = true;
				});
			}
		},

		/*Function: onGrabEnd
			
				listens to *stateremoved* events on this element.
				only triggers on the *grabbed state.
				Sets edges and potential pm-verticex-clones to stop updating their positions.
				Emits a <vertexgrabend> event.

				Parameters: 
					
					event - the event object of stateremoved

				See Also:

					<vertexgrabend>
					<onGrabStart>
					<pm-component>

		*/
		onGrabEnd: function (event) {
			if (event.detail == "grabbed") {
				this.el.emit("vertexgrabend", { vertex: this.el.object3D.name }); //pms are listening if they should update their positions
				this.freezeMotion().then(() => {
					this.data.edges.forEach((edge) => {
						edge.endsGrabbed = false;
					});
				});
			}
		},
	},

	//Group: methods
	// ----------------------------------------------

	/*Method: freezeMotion
		sets all velocities and forces of the vertex to zero.

		Returns:
			Promise - resolves when the vertex is frozen
	*/
	freezeMotion: function () {
		this.el.body.velocity.set(0, 0, 0);
		this.el.body.angularVelocity.set(0, 0, 0);
		this.el.body.inertia.set(0, 0, 0);
		this.el.body.force.set(0, 0, 0);
		this.el.body.torque.set(0, 0, 0);
		return new Promise((resolve) => {});
	},

	/*Method: setText
		sets the text label of the vertex.
	*/
	setText: function () {
		//  this.el.removeAttribute('text')
		this.el.setAttribute("text", {
			width: 0.19,
			height: 0.09,
			anchor: "center",
			align: "center",
			value: this.data.numId,
			color: "#000000",
			zOffset: 0.01,
		});
	},

	/*Method: getGeometry
		creates the object3D of the vertex.
		stores the mesh in this.mesh

		Returns:
			mesh - the object3D of the vertex
	*/
	getGeometry: function () {
		this.mat = vmat.clone();
		this.mat.color.set(this.data.color);

		switch (this.data.geometry) {
			case "sphere":
				this.geo = vSphereGeo.clone();
				break;
			case "cube":
				this.geo = vBoxGeo.clone();
				break;
			case "tetrahedron":
				this.geo = vTetraGeo.clone();
				break;
			default:
				this.geo = vSphereGeo.clone();
				break;
		}

		this.mesh = new THREE.Mesh(this.geo, this.mat);
		this.mesh.name = "vertex";
		this.el.setObject3D("mesh", this.mesh);
		this.el.object3D.name = "vertex" + this.data.numId;
		return this.mesh;
	},

	/*Method: getConfig
		turns the schema information into serializable data.

		Returns:
			newConfig - serializable data
	*/
	getConfig: function () {
		let newConfig = {
			id: this.data.numId,
			position: this.el.object3D.position.toArray(),
			geometry: this.data.geometry,
			edges: this.data.edges.map((edge) => edge.data.numId),
			neighbours: this.data.neighbours.map((vertex) => vertex.data.numId),
		};
		return newConfig;
	},
});
