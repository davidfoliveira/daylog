//
//  AppDelegate.swift
//  Daylog
//
//  Created by David Oliveira on 11/06/15.
//  Copyright (c) 2015 David Oliveira. All rights reserved.
//

import Cocoa

@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {

    @IBOutlet weak var window: NSWindow!

    let statusItem = NSStatusBar.systemStatusBar().statusItemWithLength(-2)
    var activeItem: NSMenuItem? = nil

    func applicationDidFinishLaunching(aNotification: NSNotification) {
        // Insert code here to initialize your application
        if let button = statusItem.button {
            button.image = NSImage(named: "StatusBarButtonImage")
//          button.action = Selector("printQuote:")
        }

        
        let url = NSURL(string: "http://sapo:8090/services/projects")
        let request = NSURLRequest(URL: url!)

        NSURLConnection.sendAsynchronousRequest(request, queue: NSOperationQueue.mainQueue()) {(response, data, error) in
            println(NSString(data: data, encoding: NSUTF8StringEncoding))

            let jsonResult: Dictionary = NSJSONSerialization.JSONObjectWithData(data, options: NSJSONReadingOptions.MutableContainers, error: nil) as! Dictionary<String, AnyObject>
            let projects: NSArray = jsonResult["projects"] as! NSArray
            println("loaded")

            let menu = NSMenu()
            var x = 0
            for project in projects {
                x++
                var name: String = project as! String
                var xStr = String(x)
                var item: NSMenuItem = NSMenuItem(title: name, action: Selector("printQuote:"), keyEquivalent: xStr)
                menu.addItem(item)
            }
            menu.addItem(NSMenuItem.separatorItem())
            menu.addItem(NSMenuItem(title: "Pause", action: Selector("pause:"), keyEquivalent: "p"))
            menu.addItem(NSMenuItem(title: "Resume", action: Selector("resume:"), keyEquivalent: "r"))
            menu.addItem(NSMenuItem.separatorItem())
            menu.addItem(NSMenuItem(title: "Quit", action: Selector("terminate:"), keyEquivalent: "q"))
            self.statusItem.menu = menu
        }
    
    }

    func applicationWillTerminate(aNotification: NSNotification) {
        // Insert code here to tear down your application
    }

    func printQuote(sender: AnyObject) {
        let item = sender as! NSMenuItem
        item.state = NSOnState
        if activeItem !== nil {
            activeItem!.state = NSOffState
        }
        activeItem = item

/*        let quoteText = "Never put off until tomorrow what you can do the day after tomorrow."
        let quoteAuthor = "Mark Twain"
        
        println("\(quoteText) — \(quoteAuthor)")
*/
//        println(item.description)

        var itemDescr = item.title as String
        var escDescr = itemDescr.stringByAddingPercentEncodingWithAllowedCharacters(.URLHostAllowedCharacterSet())
        let url = NSURL(string: "http://sapo:8090/services/switch?t="+escDescr!)
        let request = NSMutableURLRequest(URL: url!)
        request.HTTPMethod = "GET"
        request.setValue("Basic ZG9saXZlaXJhOmJhdGF0YXo=", forHTTPHeaderField: "Authorization")
        NSURLConnection.sendAsynchronousRequest(request, queue: NSOperationQueue.mainQueue()) {(response, data, error) in
            println(NSString(data: data, encoding: NSUTF8StringEncoding))
        }
    }

    func pause(sender: AnyObject) {
        let item = sender as! NSMenuItem
        item.state = NSOnState
        if activeItem !== nil {
            activeItem!.state = NSOffState
        }
        activeItem = item

        let url = NSURL(string: "http://sapo:8090/services/close")
        let request = NSMutableURLRequest(URL: url!)
        request.HTTPMethod = "GET"
        request.setValue("Basic ZG9saXZlaXJhOmJhdGF0YXo=", forHTTPHeaderField: "Authorization")
        NSURLConnection.sendAsynchronousRequest(request, queue: NSOperationQueue.mainQueue()) {(response, data, error) in
            println(NSString(data: data, encoding: NSUTF8StringEncoding))
        }

    }

    func resume(sender: AnyObject) {

        let url = NSURL(string: "http://sapo:8090/services/resume")
        let request = NSMutableURLRequest(URL: url!)
        request.HTTPMethod = "GET"
        request.setValue("Basic ZG9saXZlaXJhOmJhdGF0YXo=", forHTTPHeaderField: "Authorization")
        NSURLConnection.sendAsynchronousRequest(request, queue: NSOperationQueue.mainQueue()) {(response, data, error) in
            println(NSString(data: data, encoding: NSUTF8StringEncoding))
        }

    }
    
}

