import React, { Component } from 'react';
import { connect } from 'react-redux';
import { find, findIndex } from 'lodash';
import axios from 'axios';

/*----------  ACTION/THUNK CREATORS  ----------*/
import { addModel, removeModel, updateModel } from '../redux/models';

/*----------  LOCAL COMPONENTS  ----------*/
import DataTypeDropDown from './DataTypeDropDown';
import ValidationDialog from './ValidationDialog';

/*----------  LIBRARY COMPONENTS  ----------*/
import TextField from 'material-ui/TextField';
import Paper from 'material-ui/Paper';
import FlatButton from 'material-ui/FlatButton';
import RaisedButton from 'material-ui/RaisedButton';
import {Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarTitle} from 'material-ui/Toolbar';
import Checkbox from 'material-ui/Checkbox';
import {List, ListItem, makeSelectable} from 'material-ui/List';
import Subheader from 'material-ui/Subheader';
import Divider from 'material-ui/Divider';
import Avatar from 'material-ui/Avatar';
import IconButton from 'material-ui/IconButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert';
import ModeEditIcon from 'material-ui/svg-icons/editor/mode-edit';
import DeleteForeverIcon from 'material-ui/svg-icons/action/delete-forever';
import {Card, CardActions, CardHeader, CardTitle, CardText} from 'material-ui/Card';
import Toggle from 'material-ui/Toggle';

import {grey400, darkBlack, lightBlack, red400, white, blueGrey200} from 'material-ui/styles/colors';

// import {GridList, GridTile} from 'material-ui/GridList';
// import DropDownMenu from 'material-ui/DropDownMenu';
// import AutoComplete from 'material-ui/AutoComplete';
// import FloatingActionButton from 'material-ui/FloatingActionButton';
// import ContentAdd from 'material-ui/svg-icons/content/add';
// import ContentRemove from 'material-ui/svg-icons/content/remove';

let SelectableList = makeSelectable(List);

/*----------  CONSTANTS AND HELPER FUNCTIONS  ----------*/
const trash = [];

const getInitialDialogs = () => {
  return {
    modelValidation: {
      open: false,
      message: ''
    }
  };
};

const getInitialModel = () => {
  return { idx: -1, name: '', fields: [] };
};

const getInitialState = () => {
  let model = getInitialModel();
  let dialogs = getInitialDialogs();
  return {model, dialogs, selectedIdx: null, expandedFields: []};
};

const makeDialogState = (key, open, message) => {
  let state = {};
  state[key] = {};
  state[key].open = open;
  state[key].message = message;
  return state;
};

const messages = {
  reqModelName: 'Please give your model a name.',
  reqFieldName: 'Every field must have a name.',
  reqFieldType: 'Every field must have a data type.',
  dupFieldName: 'Table name already exists. Please select another name.',
};

const convertFields = fields => {
  let output = '';
  for (let field of fields) output += field.name + ', ';
  return output.slice(0, -2);
};

const isNumber = (type) => {
  switch (type) {
    case 'INTEGER':
    case 'FLOAT':
    case 'REAL':
    case 'DOUBLE':
    case 'DECIMAL': return true;
    default: return false;
  }
}

/*----------  COMPONENT  ----------*/
export class CreateModel extends Component {
  constructor(props) {
    super(props);
    this.state = getInitialState();

    /*----------  BIND INSTANCE METHODS  ----------*/
    this.openDialogWindow = this.openDialogWindow.bind(this);
    this.closeDialogWindow = this.closeDialogWindow.bind(this);
    this.toggleFieldState = this.toggleFieldState.bind(this);
    this.updateModelName = this.updateModelName.bind(this);
    this.addField = this.addField.bind(this);
    this.updateField = this.updateField.bind(this);
    this.updateValidation = this.updateValidation.bind(this);
    this.deleteField = this.deleteField.bind(this);
    this.createModel = this.createModel.bind(this);
    this.getModel = this.getModel.bind(this);
    this.saveModel = this.saveModel.bind(this);
    this.deleteModel = this.deleteModel.bind(this);
  }


  /*----------  MANAGE DIALOG WiNDOW STATE  ----------*/
  openDialogWindow(key, message) {
    let dialogs = Object.assign({}, this.state.dialogs, makeDialogState(key, true, message));
    this.setState({dialogs});
  }

  closeDialogWindow(key) {
    let dialogs = Object.assign({}, this.state.dialogs, makeDialogState(key, false, ''));
    this.setState({dialogs});
  }

  /*----------  MANAGE FIELD OPEN STATE  ----------*/
  toggleFieldState(idx) {
    console.log(this.state.expandedFields);
    let expandedFields = [...this.state.expandedFields];
    expandedFields[idx] = !expandedFields[idx];
    this.setState({expandedFields});
  }

  /*----------  EDIT SELECTED MODEL  ----------*/
  updateModelName(evt) {
    let name = evt.target.value;
    let model = Object.assign({}, this.state.model, { name });
    this.setState({model});
  }

  addField() {
    let fields = [...this.state.model.fields, {name: '', type: ''}];
    let model = Object.assign({}, this.state.model, {fields});
    let expandedFields = [...this.state.expandedFields, false];
    this.setState({ model, expandedFields });
  }

  updateField(key, val, idx) {
    let fields = [...this.state.model.fields];
    fields[idx][key] = val;
    let model = Object.assign({}, this.state.model, {fields});
    this.setState({model});
  }

  updateValidation(key, val, idx) {
    let fields = [...this.state.model.fields];
    fields[idx].validate = fields[idx].validate || {};
    fields[idx].validate[key] = val;
    let model = Object.assign({}, this.state.model, {fields});
    this.setState({model});
  }

  deleteField(idx) {
    let fields = [...this.state.model.fields];
    let expandedFields = [...this.state.expandedFields];
    fields.splice(idx, 1);
    expandedFields.splice(idx, 1);
    let model = Object.assign({}, this.state.model, {fields});
    this.setState({ model, expandedFields });
  }

  /*----------  VALIDATE MODEL BEFORE CREATE/SAVE  ----------*/
  validateModel(model) {
    let { models } = this.props;
    let storeModel = find(models, {name: model.name});
    if (storeModel && storeModel.id !== model.id) {
      this.openDialogWindow('modelValidation', messages.dupFieldName);
      return false;
    }
    if (!model.name) {
      this.openDialogWindow('modelValidation', messages.reqModelName);
      return false;
    }
    for (let field of model.fields) {
      if (!field.name) {
        this.openDialogWindow('modelValidation', messages.reqFieldName);
        return false;
      } else if (!field.type) {
        this.openDialogWindow('modelValidation', messages.reqFieldType);
        return false;
      }
    }
    return true;
  }

  /*----------  MODEL CRUD  ----------*/
  createModel() {
    let { model } = this.state;
    if (!this.validateModel(model)) return;
    let newModel = Object.assign({}, model);
    delete newModel.idx;
    this.props.addModel(newModel);
    this.setState({model: getInitialModel(), selectedIdx: null, expandedFields: []});
    axios.post('/api', {models: [newModel]});
  }

  getModel(model, selectedIdx) {
    if (trash.indexOf(model) === -1) {
      this.setState({model, selectedIdx});
    }
  }

  saveModel(savedModel) {
    let { model } = this.state;
    if (!this.validateModel(model)) return;
    this.props.updateModel(savedModel);
    this.setState({model: getInitialModel(), selectedIdx: null, expandedFields: []});
  }

  deleteModel(model) {
    trash.push(model);
    this.props.removeModel(model);
    this.setState({model: getInitialModel()});
  }

  /*----------  RENDER COMPONENT  ----------*/
  render() {
    let { closeDialogWindow,
          toggleFieldState,
          updateModelName,
          addField,
          updateField,
          updateValidation,
          deleteField,
          createModel,
          getModel,
          saveModel,
          deleteModel } = this;
    let { model, dialogs, selectedIdx, expandedFields } = this.state;
    let { models } = this.props;
    return (
      <div>
        <div className="your-models">
            <div className="row">
            <div className="col s12 m6 push-m3">
              <SelectableList>
                <div>
                  <h5 className="center-align" style={{color: darkBlack}}>
                    {models.length ? 'Your Models' : 'You have no models...'}
                  </h5>
                <Subheader className="center-align">
                  {models.length ? 'Click to edit' : 'Create one below'}
                </Subheader>
                </div>
                { models.map((model, modelIdx) => {
                  let fieldString = convertFields(model.fields);
                  return (
                    <div key={modelIdx}>
                    <ListItem
                      rightIconButton={<DeleteForeverIcon onClick={() => deleteModel(model, modelIdx)}/>}
                      innerDivStyle={{
                        backgroundColor: selectedIdx === modelIdx && grey400
                      }}
                      primaryText={model.name}
                      secondaryText={`Fields: ${fieldString}`}
                      secondaryTextLines={1}
                      onClick={() => getModel(model, modelIdx)}
                    />
                    <Divider inset={true} />
                    </div>
                  );
                })
                }
              </SelectableList>
              </div>
            </div>
        </div>
        <div className="field-definitions">
          <Paper>
            <Toolbar>
              <ToolbarGroup firstChild={true}>
              <ToolbarSeparator/>
              <div className="model-name-input">
                <TextField value={model.name}
                           style={{
                             fontSize: '1.5em'
                           }}
                           onChange={updateModelName}
                           hintText="Model Name"
                           hintStyle={{color: '#555'}}/>
              </div>
              <ToolbarSeparator/>
              { model.id && <RaisedButton label="Save"
                                          primary={true}
                                          onClick={() => saveModel(model)} /> }
              { model.id && <RaisedButton label="Delete"
                                          labelColor={white}
                                          backgroundColor={red400}
                                  onClick={() => deleteModel(model)} /> }
              { !model.id && <RaisedButton label="Create"
                                           disabled={!model.name}
                                           disabledBackgroundColor={blueGrey200}
                                           secondary={true}
                                           onClick={createModel} /> }
              </ToolbarGroup>
            </Toolbar>
            <div className="create-field-grid">
              <div className="create-field-header">
                <span className="create-field-title">Fields</span>
                <RaisedButton primary={true} label="+ ADD" onClick={addField} />
              </div>
              <div className="row">
                { model.fields.map( (field, fieldIdx) => (
                  <div className="col m12 l6" key={fieldIdx}>
                    <Card expanded={expandedFields[fieldIdx]}
                          style={{
                            marginBottom: '5%'
                          }}>
                          <CardActions>
                            <TextField value={field.name}
                                       onChange={evt => updateField('name', evt.target.value, fieldIdx)}
                                       type="text" hintText="Field Name"/>
                            <DataTypeDropDown currType={field.type}
                                              idx={fieldIdx}
                                              onClick={updateField}/>
                            <FlatButton label="DELETE FIELD"
                                        labelStyle={{color: red400}}
                                        onClick={() => deleteField(fieldIdx)}/>
                            <Toggle onToggle={() => toggleFieldState(fieldIdx)}
                                    label="More Options"
                                    labelPosition="right"/>
                          </CardActions>
                          <CardActions expandable={true}>
                            <div className="row">
                              <div className="col 4">
                                <ul>
                                  <li>
                                  <Checkbox label="UNIQUE"
                                            checked={Boolean(field.unique)}
                                            onCheck={(evt, isChecked) =>
                                              updateField('unique', isChecked, fieldIdx)}/>
                                  </li>
                                  {model.fields[fieldIdx].unique && (
                                    <li>
                                      <TextField value={field.uniqueKey}
                                               style={{
                                                 fontSize: '0.8em',
                                                 width: '100%',
                                                 marginTop: -10,
                                                 marginBottom: -10
                                               }}
                                               onChange={evt =>
                                                 updateField('uniqueKey', evt.target.value, fieldIdx)}
                                               type="text"
                                               hintText="Unique Key"/>
                                  </li>
                                  )}
                                  <li>
                                    <Checkbox label="NOT NULL"
                                              checked={field.allowNull === false}
                                              onCheck={(evt, isChecked) =>
                                                updateField('allowNull', !isChecked, fieldIdx)}/>
                                  </li>
                                  <li>
                                    <Checkbox label="PRIMARY KEY"
                                              checked={field.primaryKey}
                                              onCheck={(evt, isChecked) =>
                                                updateField('primaryKey', isChecked, fieldIdx)}/>
                                  </li>
                                  <li>
                                    <Checkbox label="AUTOINCREMENT"
                                              checked={field.autoIncrement}
                                              onCheck={(evt, isChecked) =>
                                                updateField('autoIncrement', isChecked, fieldIdx)}/>
                                  </li>
                                </ul>
                              </div>
                              <div className="col 4">
                                <ul>
                                  <li>
                                    <TextField value={field.default}
                                               style={{
                                                 fontSize: '0.8em',
                                                 width: '100%',
                                                 marginTop: -10,
                                                 marginBottom: -10
                                               }}
                                               onChange={evt =>
                                                 updateField('default', evt.target.value, fieldIdx)}
                                               type="text" hintText="Default Value"/>
                                  </li>
                                  <li>
                                    <TextField value={field.comment}
                                               style={{
                                                 fontSize: '0.8em',
                                                 width: '100%',
                                                 marginTop: -10,
                                                 marginBottom: -10
                                               }}
                                               onChange={evt =>
                                                 updateField('comment', evt.target.value, fieldIdx)}
                                               type="text" hintText="Comment"/>
                                  </li>
                                  <li>
                                    <TextField value={field.field}
                                               style={{
                                                 fontSize: '0.8em',
                                                 width: '100%',
                                                 marginTop: -10,
                                                 marginBottom: -10
                                               }}
                                               onChange={evt =>
                                                 updateField('field', evt.target.value, fieldIdx)}
                                               type="text" hintText="Field Name"/>
                                  </li>
                                </ul>
                              </div>
                              <div className="col 4">
                                <ul>
                                  <li>Validation</li>
                                  <li>
                                      <TextField value={field.validate && field.validate.is}
                                                 style={{
                                                   fontSize: '0.8em',
                                                   width: '100%',
                                                   marginTop: -10,
                                                   marginBottom: -10
                                                 }}
                                                 onChange={evt =>
                                                   updateValidation('is', evt.target.value, fieldIdx)}
                                                 type="text"
                                                 hintText="is (RegExp)"/>
                                  </li>
                                  <li>
                                      <TextField value={field.validate && field.validate.contains}
                                                 style={{
                                                   fontSize: '0.8em',
                                                   width: '100%',
                                                   marginTop: -10,
                                                   marginBottom: -10
                                                 }}
                                                 onChange={evt =>
                                                   updateValidation('contains', evt.target.value, fieldIdx)}
                                                 type="text"
                                                 hintText="contains"/>
                                  </li>
                                  { field.type === 'STRING' &&
                                    <li>
                                      <Checkbox label="isEmail"
                                                checked={field.validate && field.validate.isEmail}
                                                onCheck={(evt, isChecked) =>
                                                  updateValidation('isEmail', isChecked, fieldIdx)}/>
                                      <Checkbox label="isUrl"
                                                checked={field.validate && field.validate.isUrl}
                                                onCheck={(evt, isChecked) =>
                                                  updateValidation('isUrl', isChecked, fieldIdx)}/>
                                    </li>
                                  }
                                  { isNumber(field.type) && (
                                    <li>
                                      <TextField value={field.validate && field.validate.min}
                                                 style={{
                                                   fontSize: '0.8em',
                                                   width: '33%',
                                                   marginTop: -10,
                                                   marginBottom: -10
                                                 }}
                                                 onChange={evt =>
                                                   updateValidation('min', evt.target.value, fieldIdx)}
                                                 type="text"
                                                 hintText="min"/>
                                      <TextField value={field.validate && field.validate.max}
                                                 style={{
                                                   fontSize: '0.8em',
                                                   width: '33%',
                                                   marginTop: -10,
                                                   marginBottom: -10
                                                 }}
                                                 onChange={evt =>
                                                   updateValidation('max', evt.target.value, fieldIdx)}
                                                 type="text"
                                                 hintText="max"/>
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </CardActions>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </Paper>
        </div>
        <div className="dialogs">
          <ValidationDialog open={dialogs.modelValidation.open}
                            message={dialogs.modelValidation.message}
                            handleClose={() => closeDialogWindow('modelValidation')}/>
        </div>
      </div>
    );
  }
}


/*----------  CONNECT TO STORE  ----------*/
const mapStateToProps = ({ models }) => ({ models });
const mapDispatchToProps = dispatch => ({
  addModel: model => dispatch(addModel(model)),
  removeModel: (model) => dispatch(removeModel(model)),
  updateModel: (model) => dispatch(updateModel(model))
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CreateModel);
