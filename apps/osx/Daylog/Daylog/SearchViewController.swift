//
//  SearchViewController.swift
//  Daylog
//
//  Created by David Oliveira on 05/05/2019.
//  Copyright © 2019 David Oliveira. All rights reserved.
//

import Cocoa

class SearchViewController: NSViewController {

    @IBOutlet weak var searchText: NSTextField!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        searchText.action = #selector(self.switchTask(_:))
//        searchText.sendAction(on: .keyDown)
        // Do view setup here.
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) {
            self.keyDown(with: $0)
            return $0
        }
    }

    override func viewDidAppear() {
        searchText.stringValue = ""
    }

    override func keyDown(with event: NSEvent) {
        if event.characters == "\u{1B}" {
            let appDelegate = NSApp.delegate as! AppDelegate
            appDelegate.closePopover(sender: nil)
        }
    }
    @objc func switchTask(_ sender: Any?) {
        let appDelegate = NSApp.delegate as! AppDelegate
        appDelegate.switchTask(task: searchText.stringValue)
        appDelegate.closePopover(sender: nil)
    }
    
}

extension SearchViewController {
    // MARK: Storyboard instantiation
    static func freshController() -> SearchViewController {
        //1.
        let storyboard = NSStoryboard(name: NSStoryboard.Name("Main"), bundle: nil)
        //2.
        let identifier = NSStoryboard.SceneIdentifier("SearchViewController")
        //3.
        guard let viewcontroller = storyboard.instantiateController(withIdentifier: identifier) as? SearchViewController else {
            fatalError("Why cant i find SearchViewController? - Check Main.storyboard")
        }
        return viewcontroller
    }
}
