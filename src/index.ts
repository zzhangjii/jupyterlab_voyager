///<reference path="./lib.d.ts"/>

import {
  ActivityMonitor, PathExt
} from '@jupyterlab/coreutils';
import {
  ILayoutRestorer,
  JupyterLabPlugin,
  JupyterLab
} from '@jupyterlab/application';

import {
  ICommandPalette,InstanceTracker
} from '@jupyterlab/apputils';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  Context
} from '@jupyterlab/docregistry';

import {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

import {
  Widget, Menu
} from '@phosphor/widgets';

import {
  Message
} from '@phosphor/messaging';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import { CreateVoyager, Voyager } from 'datavoyager/build/lib-voyager';
import { VoyagerConfig } from 'datavoyager/build/models/config';
import 'datavoyager/build/style.css';
import { read } from 'vega-loader';

import {
  INotebookTracker, NotebookPanel, NotebookTracker
} from '@jupyterlab/notebook';
import {
  CodeCell
} from '@jupyterlab/cells';

import {
  ReadonlyJSONObject,PromiseDelegate
} from '@phosphor/coreutils';

/**
 * The class name added to a datavoyager widget.
 */
const Voyager_CLASS = 'jp-Voyager';

/**
 * The name of the factory that creates editor widgets.
 */
const FACTORY = 'Editor';

//import { ReactChild } from 'react';
export namespace CommandIDs {
  export
  const JL_Graph_Voyager = 'graph_voyager:open';
  export
  const JL_Table_Voyager = 'table_voyager:open';
  export
  const JL_Voyager_Save = 'voyager_graph:save';
  export
  const JL_Voyager_Save1 = 'voyager_graph:save1';
}
/**
 * A namespace for `VoyagerPanel` statics.
 */
export
namespace VoyagerPanel {
  /**
   * Instantiation options for Voyager widgets.
   */
  export
  interface IOptions {
    /**
     * The document context for the Voyager being rendered by the widget.
     */
    context: DocumentRegistry.Context;
    fileType: string;
  }
}
export
class VoyagerPanel extends Widget implements DocumentRegistry.IReadyWidget {
  static config: VoyagerConfig = {
    // don't allow user to select another data source from Voyager UI
    showDataSourceSelector: false,
    manualSpecificationOnly: true,
    hideHeader: true,
    hideFooter: true,

  }
  public voyager_cur: Voyager;
  public data_src:any;
  public fileType: String;
  // it would make sense to resolve this promise after we have parsed the data
  // and created the Voyager component, but this will trigger an attempted
  // cleanup of the spinner element, which will already have been deleted
  // by the Voyager constructor and so will raise an exception.
  // So instead we just never resolve this promise, which still gives us the
  // spinner until Voyager overwrites the element.

  constructor(options: VoyagerPanel.IOptions) {
    super();
    this.addClass(Voyager_CLASS);
    const context = this._context = options.context;
    this.fileType = options.fileType;

    this.title.label = PathExt.basename(context.path);
    context.pathChanged.connect(this._onPathChanged, this);
    this._onPathChanged();

    this._context.ready.then(_ => {
      this._ready.resolve(undefined);
      const data = context.model.toString();
      var values;
      if(this.fileType==='txt'){
        values = read(data, { type: 'json' });
      }
      else{
        values = read(data, { type: this.fileType });
      }
      if(this.fileType==='json'||this.fileType==='txt'){
        if(values['data']){
          var DATA = values['data'];
          this.data_src = DATA;
          console.log(values['data']);
          if(DATA['url']){ //check if it's url type datasource
            this.voyager_cur = CreateVoyager(this.node, VoyagerPanel.config, values['data']);
          }
          else if(DATA['values']){ //check if it's array value data source
           this.voyager_cur = CreateVoyager(this.node, VoyagerPanel.config, values['data']);
          }
        }
        else{ //other conditions, just try to pass the value to voyager and wish the best
          this.voyager_cur = CreateVoyager(this.node, VoyagerPanel.config, { values });
          this.data_src = {values};
        }
        console.log('mark": '+values['mark']);
        console.log('encoding '+values['encoding']);
        console.log('config '+values['config']);

        //update the specs if possible
        this.voyager_cur.setSpec({'mark':values['mark'],'encoding':values['encoding']});

      }
      else{
        this.voyager_cur = CreateVoyager(this.node, VoyagerPanel.config, { values });
        this.data_src = {values};
      }
    })


  }

  /**
   * Get the context for the editor widget.
   */
  get context(): DocumentRegistry.Context {
    return this._context;
  }

  /**
   * A promise that resolves when the file editor is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  private _onPathChanged(): void {
    this.title.label = PathExt.basename(this._context.localPath);
  }

  /**
   * Dispose of the resources used by the widget.
   */
  dispose(): void {
    if (this._monitor) {
      this._monitor.dispose();
    }
    super.dispose();
  }

    /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this.node.tabIndex = -1;
    this.node.focus();
  }

  protected _context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _monitor: ActivityMonitor<any, any> | null = null;
  
}

class VoyagerWidgetFactory extends ABCWidgetFactory<VoyagerPanel, DocumentRegistry.IModel> {
  // pass fileType into constructor so we know what it is and can pass it to vega-loader
  // to get the data
  constructor(private fileType: string, options: DocumentRegistry.IWidgetFactoryOptions) {
    super(options);
  }
  protected createNewWidget(context: DocumentRegistry.Context): VoyagerPanel {
    return new VoyagerPanel({context, fileType: this.fileType});
  }

}


const fileTypes = ['csv', 'json', 'tsv', 'txt','vl.json'];
function activate(app: JupyterLab, restorer: ILayoutRestorer, tracker: NotebookTracker,palette: ICommandPalette, docManager: IDocumentManager, browserFactory: IFileBrowserFactory,mainMenu: IMainMenu)/*: InstanceTracker<VoyagerPanel>*/{

  //let wdg:VoyagerPanel_DF;
  const { commands} = app;

  // Get the current cellar widget and activate unless the args specify otherwise.
  function getCurrent(args: ReadonlyJSONObject): NotebookPanel | null {
    const widget = tracker.currentWidget;
    const activate = args['activate'] !== false;     
    if (activate && widget) {
      app.shell.activateById(widget.id);
    }
    return widget;
  }


  function createNew(cwd: string, data: any) {
    return commands.execute('docmanager:new-untitled', {
      path: cwd, ext: '.vl.json', type: 'file'
    }).then(model => {
      return commands.execute('docmanager:open', {
        path: model.path, factory: FACTORY
      }).then(widget=>{
        let context = docManager.contextForWidget(widget) as Context<DocumentRegistry.IModel>;
        context.model.fromJSON(data);
        context.save().then(()=>{
            commands.execute('docmanager:open', {
            path: model.path, factory: `Voyager (json)`
            })   
        })
      });
    });
  };



  commands.addCommand(CommandIDs.JL_Graph_Voyager, {
    label: 'Open in Voyager',
    caption: 'Open the datasource in Voyager',
    execute: args => {
      const cur = getCurrent(args);
      if(cur){
        //var filename = cur.id+'_Voyager';
        let cell = cur.notebook.activeCell;
        if(cell.model.type==='code'){
          let codeCell = (cur.notebook.activeCell as CodeCell);
          let outputs = codeCell.model.outputs;
          console.log(outputs);
          let i = 0;
          //find the first altair image output of this cell,
          //(if multiple output images in one cell, currently there's no method to locate, so only select the first one by default)
          while(i<outputs.length){
            if(!!outputs.get(i).data['application/vnd.vegalite.v1+json']){
              var JSONobject = (outputs.get(i).data['application/vnd.vegalite.v1+json'] as any).data;
              console.log(JSONobject)
              let ll = app.shell.widgets('left');
              let fb = ll.next();
              while((fb as any).id!='filebrowser'){
                fb = ll.next();
              }
              let path = (fb as any).model.path as string;
              createNew(path, {data:JSONobject});
              break;
            }
            i++;
          }
        }
      }
    }
  });


  commands.addCommand(CommandIDs.JL_Table_Voyager, {
    label: 'Open in Voyager',
    caption: 'Open the datasource in Voyager',
    execute: args => {
      const cur = getCurrent(args);
      if(cur){
        //var filename = cur.id+'_Voyager';
        let cell = cur.notebook.activeCell;
        if(cell.model.type==='code'){
          let codeCell = (cur.notebook.activeCell as CodeCell);
          let outputs = codeCell.model.outputs;
          console.log(outputs);
          let i = 0;
          //find the first altair image output of this cell,
          //(if multiple output images in one cell, currently there's no method to locate, so only select the first one by default)
          while(i<outputs.length){
            if(!!outputs.get(i).data['application/vnd.dataresource+json']){
              var JSONobject = (outputs.get(i).data['application/vnd.dataresource+json'] as any).data;
              console.log(JSONobject)
              let ll = app.shell.widgets('left');
              let fb = ll.next();
              while((fb as any).id!='filebrowser'){
                fb = ll.next();
              }
              let path = (fb as any).model.path as string;
              createNew(path, {data:{'values':JSONobject}});
              break;
            }
            i++;
          }
        }
      }

    }
  });
/*
  function saveVoyagerReady(){
    //let widget = tracker.currentWidget;
    let ll = app.shell.widgets('main');
    let widget = ll.next();
    while(widget!=undefined&&!(widget as Widget).isHidden && !(widget as Widget).hasClass(Voyager_CLASS)){
      widget = ll.next();
    }
    if(widget&&widget.hasClass(Voyager_CLASS)){
      return true;
    }
    else{
      return false;
    }
}*/

  commands.addCommand(CommandIDs.JL_Voyager_Save, {
    label: 'Save Current Voyager',
    caption: 'Save the chart datasource as vl.json file',
    execute: args => {
      /*
      let widget = app.shell.currentWidget;
      if(widget!=null){
        console.log("mm is the current widget, its id is "+ widget.id);
      }
      else{
        console.log("mm is null");
      }
*/

      let widget = app.shell.currentWidget;
      if(widget){
         console.log('widget is valid: '+widget.id);
          var datavoyager = (widget as VoyagerPanel).voyager_cur;
          //let aps = datavoyager.getApplicationState();
          let spec = datavoyager.getSpec(true);
          let context = docManager.contextForWidget(widget) as Context<DocumentRegistry.IModel>;
          context.model.fromJSON(spec);
          context.save()
          /*
          console.log("1. "+ aps.bookmark.list);
          console.log("2. "+ aps.config.serverUrl);
          console.log("3. "+ aps.customWildcardFields);
          console.log("4. "+ aps.dataset.data.values[0].x);
          console.log("5. "+ aps.log.errors);
          console.log("6. "+ aps.relatedViews.isHidden);
          console.log("7. "+ aps.result);
          console.log("8. "+ aps.shelf);
          console.log("9. "+ aps.shelfPreview);
          console.log("10. "+ aps.tableschema.primaryKey);

          console.log("1. "+ spec.data);
          console.log("2. "+ spec.description);
          console.log("3. "+ spec.encoding);
          console.log("4. "+ spec.height);
          console.log("5. "+ spec.mark);
          console.log("6. "+ spec.name);
          console.log("7. "+ spec.selection);
          console.log("8. "+ spec.title);
          console.log("9. "+ spec.transform);
          console.log("10. "+ spec.width);
          */
      }
    },
    isEnabled: () =>{      
      let widget = app.shell.currentWidget;
      if(widget&&widget.hasClass(Voyager_CLASS)&&(widget as VoyagerPanel).context.path.indexOf('vl.json')!==-1){
        return true;
      }
      else{
        return false;
      }
    }
  });

  commands.addCommand(CommandIDs.JL_Voyager_Save1, {
    label: 'Save AS vl.json',
    caption: 'Save the chart datasource as vl.json file',
    execute: args => {
      let widget = app.shell.currentWidget;
      if(widget!=null){
        console.log("app.shell.currentWidget is the current widget, its id is "+ widget.id);
        if(widget.hasClass(Voyager_CLASS)){
          console.log("app.shell.currentWidget,  current widget has Voyager_class, its path is "+(widget as VoyagerPanel).context.path);
          console.log("app.shell.currentWidget,  current widget has Voyager_class, its fileType is "+(widget as VoyagerPanel).fileType);
        }
        else{
          console.log("app.shell.currentWidget ,current widget has NO Voyager_class, its class is "+widget.title);
        }
      }
      else{
        console.log("app.shell.currentWidget  is null");
      }

      widget = app.shell.activeWidget;
      if(widget!=null){
        console.log("app.shell.activeWidget is the current widget, its id is "+ widget.id);
        if(widget.hasClass(Voyager_CLASS)){
          console.log("app.shell.activeWidget,  current widget has Voyager_class, its path is "+(widget as VoyagerPanel).context.path);
        }
        else{
          console.log("app.shell.activeWidget ,current widget has NO Voyager_class, its class is "+widget.title);
        }
      }
      else{
        console.log("app.shell.activeWidget  is null");
      }
/*
      widget = tracker1.currentWidget;
      if(widget!=null){
        console.log("tracker1.currentWidget is the current widget, its id is "+ widget.id);
        if(widget.hasClass(Voyager_CLASS)){
          console.log("tracker1.currentWidget,  current widget has Voyager_class, its path is "+(widget as VoyagerPanel).context.path);
        }
        else{
          console.log("tracker1.currentWidget ,current widget has NO Voyager_class, its class is "+widget.title);
        }
      }
      else{
        console.log("tracker1.currentWidget  is null");
      }
*/
      widget = tracker.currentWidget;
      if(widget!=null){
        console.log("tracker.currentWidget is the current widget, its id is "+ widget.id);
        if(widget.hasClass(Voyager_CLASS)){
          console.log("tracker.currentWidget,  current widget has Voyager_class its path is "+(widget as VoyagerPanel).context.path);
        }
        else{
          console.log("tracker.currentWidget ,current widget has NO Voyager_class, its class is "+widget.title);
        }
      }
      else{
        console.log("tracker.currentWidget  is null");
      }


      let ll = app.shell.widgets('main');
      let widget1 = ll.next();
      while(!(widget1 as Widget).isHidden && !(widget1 as Widget).hasClass(Voyager_CLASS)){
        widget1 = ll.next();
      }
      console.log('here is the widget11111:  ')
      if(widget1&&widget1.hasClass(Voyager_CLASS)){
        console.log("Searched Widget, current widget 1 has Voyager_class");
      }
      else{
        console.log("Searched Widget, current widget 1 has NO Voyager_class, its class is ");
      }
      widget = app.shell.currentWidget;
      
      if(widget){
          var datavoyager = (widget as VoyagerPanel).voyager_cur;
          var dataSrc = (widget as VoyagerPanel).data_src;
          //let aps = datavoyager.getApplicationState();
          let spec = datavoyager.getSpec(false);
          let context = docManager.contextForWidget(widget) as Context<DocumentRegistry.IModel>;
          context.model.fromJSON({"data":dataSrc, "mark": spec.mark, "encoding": spec.encoding});
          //context.model.fromJSON(spec);
          context.saveAs()
      }
    },
  });

  let menu = new Menu({commands});
  menu.title.label = "Voyager";
  [
    CommandIDs.JL_Voyager_Save,CommandIDs.JL_Voyager_Save1
  ].forEach(command =>{
    menu.addItem({command});
  });
  mainMenu.addMenu(menu,{rank:60});


  //add context menu for altair image ouput
  app.contextMenu.addItem({
    command: CommandIDs.JL_Graph_Voyager,
    selector: '.p-Widget.jp-RenderedVegaCommon.jp-RenderedVegaLite.vega-embed.jp-OutputArea-output'
  });
  app.contextMenu.addItem({
    command: CommandIDs.JL_Graph_Voyager,
    selector: '.p-Widget.jp-RenderedImage.jp-OutputArea-output'
  });


  app.contextMenu.addItem({
    command: CommandIDs.JL_Table_Voyager,
    //selector: '.p-Widget.jp-RenderedHTMLCommon.jp-RenderedHTML.jp-mod-trusted.jp-OutputArea-output'
    selector: '.dataframe'
  });

  //add tsv file type to docRegistry to support "Open With ..." context menu;
  app.docRegistry.addFileType({
    name: 'tsv',
    extensions: ['.tsv']
  });
  //add txt file type to docRegistry to support "Open With ..." context menu;
  app.docRegistry.addFileType({
    name: 'txt',
    extensions: ['.txt']
  });

  fileTypes.map(ft => {
    const factoryName = `Voyager (${ft})`;
    const tracker1 = new InstanceTracker<VoyagerPanel>({ namespace: factoryName });  
    const factory = new VoyagerWidgetFactory(
      ft,
      {
        name: factoryName,
        fileTypes: [ft],
        readOnly: true
      }
    );
    

    // Handle state restoration.
    
    restorer.restore(tracker1, {
      command: 'docmanager:open',
      args: widget => ({ path: widget.context.path, factory: factoryName }),
      name: widget => widget.context.path
    });

    app.docRegistry.addWidgetFactory(factory);
    let ftObj = app.docRegistry.getFileType(ft);
    
    if(ftObj==undefined){
      console.log("app docreg getfile type: undefined");
    }
    else{
      console.log("app docreg getfile type: "+ftObj.name);
    }
    
    factory.widgetCreated.connect((sender, widget) => {
      // Track the widget.
      tracker1.add(widget);
      widget.context.pathChanged.connect(()=>{tracker1.save(widget);});
      if (ftObj) {
        if (ftObj.iconClass)
          widget.title.iconClass = ftObj.iconClass;
        if (ftObj.iconLabel)
          widget.title.iconLabel = ftObj.iconLabel;
      }
    });
    
  });
  //return tracker1;
}

//const plugin: JupyterLabPlugin<InstanceTracker<VoyagerPanel>> = {
  const plugin: JupyterLabPlugin<void> = {
  // NPM package name : JS object name
  id: 'jupyterlab_voyager:plugin',
  autoStart: true,
  requires: [ILayoutRestorer, INotebookTracker,ICommandPalette,IDocumentManager, IFileBrowserFactory, IMainMenu],
  activate: activate
};
export default plugin;

