//
//  AppDelegate.swift
//  Daylog
//
//  Created by David Oliveira on 04/05/2019.
//  Copyright © 2019 David Oliveira. All rights reserved.
//

import Cocoa


@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {

    let statusItem = NSStatusBar.system.statusItem(withLength:NSStatusItem.squareLength)
    let popover = NSPopover()
    var activeItem: NSMenuItem? = nil
    var projects : [String]? = []
    let hotKey = HotKey(key: .space, modifiers: [.control, .option])
    var endpoint : String? = nil
    var authentication : String? = nil

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        endpoint = UserDefaults.standard.string(forKey: "Endpoint")
        authentication = UserDefaults.standard.string(forKey: "Authentication")
        if endpoint == nil {
            UserDefaults.standard.set("http://127.0.0.1:8092", forKey: "Endpoint");
            UserDefaults.standard.set("Basic ZG9saXZlaXJhOmRhdmlkejEyMw==", forKey: "Authentication")
            endpoint = UserDefaults.standard.string(forKey: "Endpoint")
        }

        if let button = statusItem.button {
            button.image = NSImage(named:NSImage.Name("Checkicon"))
            button.action = #selector(statusClick(_:))
        }
        popover.contentViewController = SearchViewController.freshController()
        updateMenu()
        Timer.scheduledTimer(timeInterval: 60.0, target: self, selector: #selector(AppDelegate.updateMenu), userInfo: nil, repeats: true)

        hotKey.keyDownHandler = {
            self.togglePopover(nil)
        }
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        // Insert code here to tear down your application
    }

    @objc func printQuote(_ sender: Any?) {
        let quoteText = "Never put off until tomorrow what you can do the day after tomorrow."
        let quoteAuthor = "Mark Twain"
        
        print("\(quoteText) — \(quoteAuthor)")
    }

    
    @objc func statusClick(_ sender: Any?) {
        print("STATUS CLICK")
    }

    @objc func switchToTask(_ sender: Any?) {
        let item = sender as! NSMenuItem
        item.state = NSControl.StateValue.on
        if activeItem !== nil {
            activeItem!.state = NSControl.StateValue.off
        }
        activeItem = item
        let itemDescr : String! = item.title;
        switchTask(task: itemDescr);
    }

    @objc func switchTask(task : String) {
        let encodedItem : String! = (task).addingPercentEncoding( withAllowedCharacters: .urlQueryAllowed)
        getJSON(url: "/services/switch?t="+encodedItem, callback: { content, error in
            self.constructMenu(active: task)
        })
    }

    @objc func togglePopover(_ sender: Any?) {
        if popover.isShown {
            closePopover(sender: sender)
        } else {
            showPopover(sender: sender)
        }
    }
    
    func showPopover(sender: Any?) {
        if let button = statusItem.button {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: NSRectEdge.minY)
        }
    }
    
    func closePopover(sender: Any?) {
        popover.performClose(sender)
    }

    @objc func constructMenu(active : String?) {
        let menu = NSMenu()

        // If it has an active element
        if (active != nil) {
            let item = NSMenuItem(title: active!, action: #selector(AppDelegate.switchToTask(_:)), keyEquivalent: "0")
            item.state = NSControl.StateValue.on
            item.isEnabled = false
            menu.addItem(item)
            menu.addItem(NSMenuItem.separator())
        }

        var x : Int = 0
        for project in projects! {
            if ( project == active ) {
                continue;
            }
            x += 1
            let name: String = project
            let xStr: String = String(x)
            let item: NSMenuItem = NSMenuItem(title: name, action: #selector(AppDelegate.switchToTask(_:)), keyEquivalent: xStr)
            menu.addItem(item)
        }
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Pause", action: #selector(AppDelegate.pause(_:)), keyEquivalent: "p"))
        menu.addItem(NSMenuItem(title: "Resume", action: #selector(AppDelegate.resume(_:)), keyEquivalent: "r"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        self.statusItem.menu = menu
    }

    @objc func updateMenu() {
        getJSON(url: "/services/topprojects", callback: { response, error in
            var active : String? = nil

            if let topProjects = response as? [String: Any] {
                self.projects = topProjects["projects"] as! [String]
            }

            if let content = response as? [String: Any] {
                if let isActive = content["active"] as? NSNull {
                    active = nil;
                }
                else {
                    active = content["active"] as! String
                }
            }

            self.constructMenu(active: active)
        })
    }


    @objc func pause(_ sender: Any?) {
        let item = sender as! NSMenuItem
        item.state = NSControl.StateValue.on
        if activeItem !== nil {
            activeItem!.state = NSControl.StateValue.off
        }
        activeItem = item

        getJSON(url: "/services/close", callback: { content, error in
            print("Closed")
        })
    }
    
    @objc func resume(_ sender: Any?) {
        getJSON(url: "/services/close", callback: { content, error in
            print("Resume")
        })
    }
    
    @objc func getJSON(url : String, callback: @escaping (Any?, Error?) -> Void) {
        guard let url = URL(string: endpoint! + url) else {return}
        var request = URLRequest(url: url)
        if authentication != nil {
            request.setValue(authentication, forHTTPHeaderField: "Authorization")
        }
        let task = URLSession.shared.dataTask(with: request, completionHandler: { data, response, error in
            guard let dataResponse = data,
                error == nil else {
                    print(error?.localizedDescription ?? "Response Error")
                    return }
            do{
                //here dataResponse received from a network request
                let projects = try JSONSerialization.jsonObject(with: dataResponse, options: [])
//                print(projects)
                //                let projects = try JSONDecoder().decode([String: Any].self, from: dataResponse)
//                let jsonResponse = try? JSONSerialization.jsonObject(with: dataResponse, options: [])
//                let jsonResponse = try JSONSerialization.jsonObject(with:
//                    dataResponse, options: [])
//                print(projects)
//                print(jsonResponse) //Response result
                callback(projects, nil)
            } catch let parsingError {
                print("Error", parsingError)
                callback(nil, parsingError)
            }
        })
        task.resume()
    }
    
}
