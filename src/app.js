const express = require('express');
const app = express();
const router = express.Router();
const serverless = require('serverless-http');
const fetch = require('node-fetch').default;
const dotenv = require('dotenv');
dotenv.config();


const headers = {
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "Authorization": "Basic " + Buffer.from(process.env.USERNAME+":"+process.env.PERSONAL_ACCESS_TOKEN).toString('base64')
}


router.get('/', async (req,res)=>{
    const order = req.query.order || "desc";
    const lang =  req.query.lang ? req.query.lang.toLowerCase() : "scala";
    const langpecnt = req.query.langpecnt || 100;
    const page = req.query.page || 1;
    let url = `https://api.github.com/search/issues?q=label:%22good%20first%20issue%22+language:${lang}+state:open&sort=created&order=${order}&per_page=100&page=${page}`
    const response = await fetch(url, { method: 'GET', headers: headers})
    const resultsJson = await response.json()
    const goodFirstIssueData = resultsJson.items
    const languagePercentages = await Promise.all(goodFirstIssueData.map(async item=>{
      let langResponse = await fetch(item.repository_url+"/languages", { method: 'GET', headers: headers})
      let languages = await langResponse.json()
      let sum = Object.values(languages).reduce((acc,val)=>acc+val,0)
      let selectedLangBytes = Object.values(languages)[Object.keys(languages).map(k=>k.toLowerCase()).indexOf(lang)]
      return (selectedLangBytes/sum)*100
    }))
    const filteredLangIndex =  languagePercentages.reduce((arr, percent, index) => {
        if(percent >= langpecnt)  arr.push(index);
        return arr;
      }, []);
    const filteredRepo =  goodFirstIssueData.filter((repo,index) => filteredLangIndex.includes(index)) 
      

    res.json(filteredRepo)
    
    
    
    
})

app.use('/.netlify/functions/app', router);

module.exports.handler = serverless(app);