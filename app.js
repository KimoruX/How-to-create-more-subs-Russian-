"use strict";
require('chromedriver');
const dateFormat = require('dateformat');
const webdriver = require("selenium-webdriver");
const chrome    = require("selenium-webdriver/chrome");

const Bosslike = require("./bosslike");
const config   = require("./config");
const DBLog    = require('./dblog');

//const sqlite3 = require('sqlite3').verbose();

const {log, error, accName, dbname, profile, social, count} = config;

log(dbname);
//const db = new sqlite3.Database(`logs/${dbname}`);

function connectBrowser() {

    let options = new chrome.Options();
    options.setChromeBinaryPath(config.chrome_options.binaryPath);
    options.addArguments('user-data-dir=' + profile);
    options.addArguments('disable-infobars');
    options.addArguments('no-pings');
    options.addArguments('window-size=1000,825');
    
    //headless
    // dosen't work on Chrome 61, Cromedriver 2.31
    //options.addArguments('headless');
    //options.addArguments('disable-gpu');
    //options.addArguments('disable-plugins');
    //options.addArguments('remote-debugging-port=9222');


    let capabilities  = new webdriver.Capabilities(webdriver.Capabilities.chrome());        
    capabilities.set('TIMEOUTS', {
        implicit: 1500,
        pageLoad: 40*1000
    });
    

    let driver = new webdriver.Builder()
        .setChromeOptions(options)
        .withCapabilities(capabilities)
        .build();

 //   driver.manage().timeouts().implicitlyWait(1500); 
//    driver.manage().timeouts().pageLoadTimeout(40*1000);

    return driver;    
}

async function run() {
    
    let driver = connectBrowser();
    let dbLog;// = new DBLog(db);
    let bosslike = new Bosslike(driver, dbLog);

    bosslike.open(social, 'all');     
    try {
        await bosslike.waitForLogin();
    } catch(e) {    
        error(e, "Login not perfomed");
        return;
    } 

    for (let i = 0; i < count; i++) {
        
        if (i % 5 === 0) {
            log("\x1b[33m" + i, dateFormat(new Date, 'HH:MM:ss, dd.mm.yy'), "\x1b[39m");
        } else {
            log("\x1b[33m" + i, "\x1b[39m");
        }

        let taskType = bosslike.getTaskType(i);

        let isOpen = await bosslike.open(social, taskType);
        if (!isOpen) {
            try {
                bosslike.driver.quit();
            } catch (e) {
                error(e, "quit");               
            }    
            log("Reconnecting to browser");
            bosslike.driver = connectBrowser();
            await config.sleep(config.PAUSE.RECONNECTING);
            continue;
        }    
        bosslike.mainWindow = await bosslike.driver.getWindowHandle();

        try {
            let title = accName + ' (' + (count-i) + ')';
            await bosslike.driver.executeScript(`window.document.title = "${title}"`);
        } catch(e){
            error(e, "");
        }
        
        if (!await bosslike.waitForTasksToBeLoaded()) continue;

        try {
            await bosslike.getTasksAndCompleteFirst();
        } catch(e) {
            error(e, "Can't copmlete task");
        }      
        await config.sleep(config.PAUSE.AFTER_TASK_COMPLETE);
    }   

    if (dbLog)
        dbLog.close();
        
    if (count > 0) {
        bosslike.driver.quit();
        log('Complete');
    }

};

run();
