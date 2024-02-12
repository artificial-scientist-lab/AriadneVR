/* Class: graph-library-component

	Added on hte controller that does not have the graph-editor-component.
	Provides the controller with a menu to spawn graphs from the library.
*/
AFRAME.registerComponent("graph-library", {
	// Group: schema and attributes
	// ----------------------------------------------

	/*Property: Attributes
		this.library - library of graphs, generated from json by init()
	*/
	schema: {},

	// Group: lifecycle-handlers
	// ----------------------------------------------

	/*Constructor: init
		Initialises the component.
		Sets the library and adds a controller menu to the controller
	*/
	init: function () {
		this.library = {
			graphFilePath: "./processedJSON/",
			graphs: {},
		};
		const index = this.grabJSON("./processedJSON/", "index.json");

		//stock the library with graphs
		for (folder in index) {
			this.library.graphs[folder] = {};
			index[folder].forEach((graph) => {
				this.library.graphs[folder][graph] = this.grabJSON(
					this.library.graphFilePath + folder + "/",
					graph + ".json"
				);
			});
		}

		this.el.setAttribute("controller-menu", {
			buttons: Object.keys(index),
			subMenus: Object.values(index),
			spawnKey: "ybuttondown",
			actionKey: "xbuttondown",
		});

		this.addEventListeners();
	},

	// Group: event-handlers
	// ----------------------------------------------

	events: {
		/*Function: spawnGraph
			Spawns a graph from the library. Listens to the graph name.

			Parameters:
				event - event object with the graph name in the detail delivered by the button of the controller menu

			See Also:
				<button-component>,
				<controller-menu-component>

		*/
		spawnGraph: function (event) {
			const button = event.target;
			const folder = button.parentNode.id;
			let graphName = event.detail.name;
			const graph = this.library.graphs[folder][graphName];

			graphName =
				graph.counter > 0 ? `${graphName}-${graph.counter}` : graphName;

			const g = document.createElement("a-entity");
			this.el.sceneEl.appendChild(g);
			g.setAttribute("id", `graph-${graphName}`);
			g.setAttribute("graph", {
				name: graphName,
				graphData: JSON.stringify(graph),
			});
			g.setAttribute("grabbable", {
				startButtons: "gripdown",
				endButtons: "gripup",
				usePhysics: true,
			});

			graph["counter"] = graph.counter == undefined ? 1 : graph.counter + 1;
		},
	},

	// Group: methods
	// ----------------------------------------------

	/*Method: addEventListeners
		Adds event listeners to the controller menu buttons.
	*/
	addEventListeners: function () {
		for (folder in this.library.graphs) {
			for (graph in this.library.graphs[folder]) {
				this.el.addEventListener(graph, this.events.spawnGraph);
			}
		}
	},

	/*Method: grabJSON
		Loads a JSON file from the server.

		Parameters:
			path - path to the file
			name - name of the file

		Returns:
			file - JSON file
	*/
	grabJSON: function (path, name) {
		let request = new XMLHttpRequest();
		request.open("GET", path + name, false);
		request.send(null);
		if (request.status === 200) {
			file = JSON.parse(request.responseText);
		}
		return file;
	},
});
