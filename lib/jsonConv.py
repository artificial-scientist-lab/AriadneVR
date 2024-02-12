import json
from argparse import ArgumentParser
from pathlib import Path
import igraph as ig
import numpy as np
import cmath as cm


def processJSON(jsonPath):
    """Reads the config and source files from the PyTheus output folder and returns the data as dictionaries.

    Args:
        jsonPath (pathlib.Path): path to the PyTheus output folder

    Returns:
        dict, dict: config_dict, graph_dict
    """
    configPath = None
    sourcePath = None

    ## Find the config and source files in the PyTheus output folder
    for file in jsonPath.glob("*.json"):
        if file.name.startswith("config") or file.name.startswith("summary"):
            configPath = file

        if file.name.startswith("plot"):
            sourcePath = file

        if configPath and sourcePath:
            break

    ## Load the config and source files if available
    source_file = open(sourcePath)
    graph_dict = json.load(source_file)

    if configPath != None:
        config_dict = open(configPath)
        config_dict = json.load(config_dict)
    else:
        config_dict = {}

    return config_dict, graph_dict


def buildGraphJSON(config_dict, graph_dict, sorter):
    """Builds a JSON string from the config and source dictionaries.

    Args:
        config_dict (dict): dictionaires created by processJSON
        graph_dict (dict): dictionaires created by processJSON
        sorter (str, Path): igraph 3D sorter identifier or path to a VR-exported Graph file.

    Returns:
        json: _description_
    """

    ## local function to set the sibling configuration for each edge
    def setSiblingConfigs(list_of_edges):
        """
            Initial sibling configuration, used to identify edges with the same endpoints.
            Recursively finds all sibling groups and sets the sibling configuration for each edge in the group.

        Args:
            list_of_edges (): list of edges in the graph
        """
        if len(list_of_edges) == 0:
            ## if no edges are left
            return

        edge = list_of_edges[0]  ##first edge of the list under study

        ## find the sibling group
        ## TODO: Create a saveguard against incorrectly sorted edges
        sibling_list = list(
            filter(lambda x: x["config"][:2] == edge["config"][:2], list_of_edges)
        )
        ## edges that aren't in the sibling group
        remaining_list = list(
            filter(lambda x: x["config"][:2] != edge["config"][:2], list_of_edges)
        )

        for sibling in sibling_list:

            ## create the sibling configuration
            sibling["siblingConfig"] = [
                len(sibling_list) - 1,
                sibling_list.index(sibling),
                [f'edge__{sib["id"]}' for sib in sibling_list if sib != sibling],
            ]

            ## replace the old edge entry with the now updated entry
            mask = [edge["config"] == sibling["config"] for edge in edge_list]
            index = mask.index(True)
            edge_list[index] = sibling

        ## look for remaining sibling groups
        setSiblingConfigs(remaining_list)

    edges = np.array(
        [
            np.fromstring(key[1:-1], sep=",", dtype=np.int64)
            for key in graph_dict["graph"].keys()
        ]
    )
    graph = ig.Graph(edges[:, :2], directed=False)

    ## check if the layout is given as a path or identifier
    if isinstance(sorter, str):
        lyt = graph.layout(sorter, dim=3)
        lyt.scale(1e-1)
    else:
        layout_file = open(sorter)
        layout_file = json.load(layout_file)
        lyt = [
            np.array(vertex["position"]) for vertex in layout_file["graph"]["vertices"]
        ]

    edge_list = []
    vertex_list = []
    ## create the edge dictionaries
    for i, edge in enumerate(graph.es):
        weight = graph_dict["graph"][str(tuple(edges[i]))]
        if isinstance(weight, list):
            amplitude = float(np.abs(complex(*weight)))
            phase = (
                cm.phase(complex(*weight)) / np.pi
            )  # edge weight is stored in units of pi
        else:
            amplitude = float(np.abs(complex(weight)))
            phase = (
                cm.phase(complex(weight)) / np.pi
            )  # edge weight is stored in units of pi

        tmp_dict = {
            "id": i,
            "config": edges[i].tolist(),
            "amplitude": amplitude,
            "phase": phase,
            "siblingConfig": [0, 0, []],
        }
        edge_list.append(tmp_dict)

    ## set the sibling configuration for each edge
    setSiblingConfigs(edge_list)

    ## create the vertex dictionaries
    for i, vertex in enumerate(graph.vs):
        tmp_dict = {
            "id": i,
            "position": list(lyt[i]),
            "geometry": "sphere",
            "edges": [e.index for e in vertex.incident()],
            "neighbours": graph.neighbors(i),
        }
        vertex_list.append(tmp_dict)

    graph_entity = {
        "graph": {
            "vertices": vertex_list,
            "edges": edge_list,
        }
    }

    ## fill in the configuration parameters and vertex geometries from the config
    if "amplitudes" in config_dict:
        graph_entity["graph"]["amplitudes"] = config_dict["amplitudes"]

    if "target_state" in config_dict:
        graph_entity["graph"]["target_state"] = config_dict["target_state"]

    if "in_nodes" in config_dict:
        graph_entity["graph"]["in_nodes"] = config_dict["in_nodes"]
        for v in graph_entity["graph"]["vertices"]:
            if v["id"] in config_dict["in_nodes"]:
                v["geometry"] = "tetrahedron"
    if "out_nodes" in config_dict:
        graph_entity["graph"]["out_nodes"] = config_dict["out_nodes"]

    if "single_emitters" in config_dict:
        graph_entity["graph"]["single_emitters"] = config_dict["single_emitters"]
        for v in graph_entity["graph"]["vertices"]:
            if v["id"] in config_dict["single_emitters"]:
                v["geometry"] = "tetrahedron"

    if "num_anc" in config_dict:
        graph_entity["graph"]["num_anc"] = config_dict["num_anc"]
        if config_dict["num_anc"] != 0:
            for v in graph_entity["graph"]["vertices"][-config_dict["num_anc"] :]:
                v["geometry"] = "cube"

    graph_entity = json.dumps(graph_entity, indent=4)
    return graph_entity


def main(args):
    ## Create the category directory if it doesn't exist
    base_path = Path("processedJSON")
    dir_path = base_path / args.targetPath.parent.name
    dir_path.mkdir(parents=True, exist_ok=True)

    ## Write the new graph to the target path
    file_path = base_path / args.targetPath

    assert (
        file_path.parents[-2] == base_path
    ), f"""invalid target path {args.targetPath} \n
        NOTE: no leading '/' allowed"""

    with open(file_path, "w+") as new:

        graph = buildGraphJSON(*processJSON(args.graphFolder), args.sorter)
        print(f"saving graph to {file_path.absolute()}")
        new.write(graph)

    ## Update the index
    index = open(base_path / "index.json")
    old_index = json.load(index)
    with open(base_path / "index.json", "w+") as index:
        print(f"found index.json at {base_path.absolute()}")
        if args.targetPath.parent.name in old_index.keys():
            if args.targetPath.name[:-5] not in old_index[args.targetPath.parent.name]:
                old_index[args.targetPath.parent.name].append(args.targetPath.name[:-5])
        else:
            old_index.update({args.targetPath.parent.name: [args.targetPath.name[:-5]]})

        new_index = json.dumps(old_index, indent=4)
        index.write(new_index)
        print("index.json updated")


if __name__ == "__main__":

    parser = ArgumentParser(
        description="Converts PyTheus output to VRiadne compatible structure. Needs to be run from within the same directory that contains processedJSON"
    )
    parser.add_argument(
        "--sorter",
        type=str,
        default="kk",
        help="Layout algorithm or path to layout file.",
    )
    parser.add_argument(
        "--graphFolder",
        type=Path,
        help="Path to the folder containing the pyTheus output .json files eg. ./noon2m3ph1anc",
    )
    parser.add_argument(
        "--targetPath",
        type=Path,
        help="Path to store the output in processedJSON folder. Should contain a folder name (graph category) and a file name (graph name). eg. Communication/3pES.json ",
    )
    args = parser.parse_args()
    main(args)
