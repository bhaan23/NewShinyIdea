import fs from 'fs';
import Alert from '../Objects/Alert.js';
const { dialog } = require('electron').remote;
import { AlertType } from '../Objects/Enums.js';

export default class NodeService {

	constructor() {
		this.topNodeIds = null;
		this.allNodes = null;
		this.nodeMap = null;
		this.completedNodeIds = null;
		this.needsItemLookup = false;
		this.progressionFileLocation = null;

		this.lastSave = null;
	}

	setup(progressionFile) {
		this.setupShell();
		this.progressionFileLocation = progressionFile;

		const progressionData = fs.readFileSync(progressionFile, { encoding: 'utf-8' });
		if (progressionData) {
			this.allNodes = JSON.parse(progressionData).progression;
			this.createNodeMap();
			this.createDependencyGraph();
		}

		this.createSavePoint();
	}

	setupShell() {
		this.progressionFileLocation = null;
		this.needsItemLookup = false;
		this.topNodeIds = [];
		this.allNodes = [];
		this.nodeMap = {};
		this.completedNodeIds = [];

		this.createSavePoint();
	}

	createEmptyNode() {
		return {
			id: '',
			title: '',
			completionTrigger: '',
			description: '',
			nodesNeeded: [],
			hidden: false,
			completed: false
		}
	}

	addNode(progressionNode) {
		this.allNodes.push(progressionNode);
		this.nodeMap[progressionNode.id] = {
			dependantNodeIds: [],
			progressionData: progressionNode
		}
	}

	removeNode(id) {
		delete this.allNodes[id];
		delete this.nodeMap[id];
	}

	createNodeMap() {
		for (let progressionNode of this.allNodes) {
			if (progressionNode.title) {
				if (Object.keys(this.nodeMap).includes(progressionNode.id)) {
					const alertBody = `Two nodes with the same id:[${progressionNode.id}] have been found. Stopping the upload.`;
					new Alert(alertBody, AlertType.NEGATIVE, () => { });
					throw Error(`A node with id:[${progressionNode.id}] already exists.`);
				}
				if (progressionNode.completed) {
					this.completedNodeIds.push(progressionNode.id);
				} else if (progressionNode.completionTrigger.toLowerCase().startsWith('item|') || progressionNode.completionTrigger.toLowerCase().startsWith('gems|')) {
					this.needsItemLookup = true;
				}
				this.nodeMap[progressionNode.id] = {
					dependantNodeIds: [],
					progressionData: progressionNode
				}
			}
		}
	}

	createDependencyGraph() {
		let id;
		try {
			for (id of Object.keys(this.nodeMap)) {
				const dependantNodeIds = this.nodeMap[id].progressionData.nodesNeeded;
				let i = 0;
				for (let dependantId of dependantNodeIds) {
					if (!this.completedNodeIds.includes(dependantId)) {
						this.nodeMap[dependantId].dependantNodeIds.push(id);
						i += 1;
					}
				}

				// Top level node
				if (i === 0 && !this.completedNodeIds.includes(id)) {
					this.topNodeIds.push(id);
				}
			}
		} catch (e) {
			new Alert(`There was an error finding the dependencies for the node with id: ${id}. Stopping creation.`, AlertType.NEGATIVE, () => { });
			throw Error(`There was an error finding the dependencies for the node with id: ${id}`);
		}
	}

	createSaveObject() {
		let outputList = [];
		for (let node of this.allNodes) {
			if (node && this.nodeMap[node.id]) {
				outputList.push(this.nodeMap[node.id].progressionData);
			}
		}

		return JSON.stringify({ progression: outputList }, null, 2);
	}

	createSavePoint() {
		this.lastSave = this.createSaveObject();
	}

	save(filename) {
		const saveData = this.createSaveObject();

		if (filename || this.progressionFileLocation) {
			this._writeSaveData(filename || this.progressionFileLocation, saveData);
		} else {
			filename = dialog.showSaveDialog({
				filters: [{
					name: 'JSON', extensions: ['json']
				}]
			});
			if (filename) {
				this._writeSaveData(filename, saveData);
				this.progressionFileLocation = filename;
			}
		}
	}

	_writeSaveData(filename, saveData) {
		fs.writeFile(filename, saveData, { encoding: 'utf-8' }, (error) => {
			if (error) {
				new Alert('There was an error saving the progression.', AlertType.NEGATIVE, () => { });
			} else {
				this.lastSave = saveData;
				new Alert('Your progression was saved.', AlertType.POSITIVE, () => { });
			}
		});
	}

	canSave() {
		return this.lastSave !== this.createSaveObject();
	}
}