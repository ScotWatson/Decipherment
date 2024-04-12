/*
(c) 2024 Scot Watson  All Rights Reserved
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

const initPageTime = performance.now();

const loadInterface = loadWindow.then(function () {
  return import("https://scotwatson.github.io/WebInterface/20240316/interface.mjs");
});

Promise.all( [ loadInterface ] ).then(start, fail);

function fail() {
  console.log("Fail");
}

function start([ Interface ]) {
  try {
    alert("Test");
    const BODY = Interface.createBodyObject({});
    const mainLayout = BODY.createAttached({
      objectId: Interface.OBJECT_LAYOUT,
      parameters: {
        layoutId: Interface.LAYOUT_HEADER,
      },
    });
    mainLayout.createAttached({
      area: "header",
      objectId: Interface.OBJECT_TEXT,
      parameters: {
        text: "Decipherment",
      },
    });
    mainLayout.createAttached({
      area: "body",
      objectId: Interface.OBJECT_TEXT,
      parameters: {
        text: "Select File",
      },
    }).addClickListener({
      handler: readFile,
    });
    async function readFile() {
      const file = await Interface.modalSingleFile({});
      if (file !== null) {
        interpretFile(file);
      }
    }
    const threshold = 2;
    const zThreshold = 0;
    async function interpretFile(file) {
      const text = await file.text();
      const display = mainLayout.createAttached({
        area: "body",
        objectId: Interface.OBJECT_HTML,
        parameters: {
        },
      });
      const mapUnigram = countNgrams(text, 1);
      const arrUnigramResults = getUnigramResults(mapUnigram, text.length);
      arrUnigramResults.sort(function (a, b) {
        return (a.ratio < b.ratio) ? 1 : -1;
      });
      addUnigramTable(display, arrUnigramResults);
      const mapDigram = countNgrams(text, 2);
      const mapTrigram = countNgrams(text, 3);
      const arrDigramResults = getDigramResults(mapDigram, mapUnigram);
      console.log(arrDigramResults);
      /*
      const arrUnigramPrefixes = getUnigramPrefixes(arrDigramResults);
      addUnigramPrefixTable(arrUnigramPrefixes, display);
      const arrUnigramSuffixes = getUnigramSuffixes(arrDigramResults);
      addUnigramSuffixTable(arrUnigramSuffixes, display);
      arrDigramResults.sort(function (a, b) {
        return (a.z < b.z) ? 1 : -1;
      });
      addDigramTable(display, arrDigramResults);
      const arrTrigramResults = getTrigramResults(mapTrigram, mapDigram, mapUnigram);
      console.log(arrTrigramResults);
      arrTrigramResults.sort(function (a, b) {
        return (a.z < b.z) ? 1 : -1;
      });
      addTrigramTable(display, arrTrigramResults);
      */
      console.log("done");
    }
    function countGram(gram, excludePrefixes, excludeSuffixes) {
      let index = 0;
      function check() {
        for (const prefix of excludePrefixes) {
          if (text.at(index - 1) === prefix) {
            return false;
          }
        }
        for (const suffix of excludeSuffixes) {
          if (text.at(index + gram.length) === suffix) {
            return false;
          }
        }
        return true;
      }
      index = text.indexOf(gram);
      let count = 0;
      while (index !== -1) {
        if (check()) {
          ++count;
        }
        index = text.indexOf(gram, index + 1);
      }
      return count;
    }
    function strPresent(str) {
      let ret = "";
      for (const char of str) {
        if (char.charCodeAt(0) <= 0x20) {
          ret += String.fromCharCode(0xFFFD);
        } else {
          ret += char;
        }
      }
      ret += " (";
      for (const char of str) {
        ret += " " + char.charCodeAt(0).toString(16).padStart(2, "0");
      }
      ret += " )";
      return ret;
    }
    function countUnigrams(text) {
      const mapUnigram = new Map();
      for (const char of text) {
        let obj = mapUnigram.get(char);
        if (!obj) {
          obj = {
            str: char,
            count: 0,
          };
          mapUnigram.set(char, obj);
        }
        ++obj.count;
      }
      return mapUnigram;
    }
    function countNgrams(text, n) {
      const mapNgram = new Map();
      if (text.length < n) {
        return mapNgram;
      }
      let buffer = text.substring(0, n);
      parse();
      let i = n + 1;
      while (i < text.length) {
        const char = text[i];
        buffer = buffer.substring(1) + char;
        parse();
        ++i;
      }
      const numSamples = (text.length - n + 1);
      for (const obj of mapNgram.values()) {
        obj.ratio = obj.count / numSamples;
        obj.mean = (obj.count + 1) / (numSamples + 2);
        obj.variance = ((obj.count + 1) * (obj.count + 2)) / ((numSamples + 2) * (numSamples + 3)) - (obj.mean * obj.mean);
      }
      return mapNgram;
      function parse() {
        let obj = mapNgram.get(buffer);
        if (!obj) {
          obj = {
            str: buffer,
            count: 0,
          };
          mapNgram.set(obj.str, obj);
        }
        ++obj.count;
      }
    }
    function getUnigramResults(mapUnigram, textLength) {
      const arrUnigramResults = [];
      for (const entry of mapUnigram.entries()) {
        const objCount = entry[1];
        if (objCount.count < threshold) {
          continue;
        }
        let objResult = {
          str: objCount.str,
        };
        const char1 = objCount.str[0];
        objResult.ratio = objCount.count / textLength;
        arrUnigramResults.push(objResult);
      }
      return arrUnigramResults;
    }
    function getDigramResults(mapDigram, mapUnigram) {
      for (const objDigram of mapDigram.values()) {
        const objChar0 = mapUnigram.get(objDigram.str[0]);
        const objChar1 = mapUnigram.get(objDigram.str[1]);
        if ((objChar0.count < threshold) || (objChar1.count < threshold) || (objDigram.count < threshold)) {
          objDigram.z = 0;
          continue;
        }
        const char0MeanSquared = objChar0.mean * objChar0.mean;
        const char1MeanSquared = objChar1.mean * objChar1.mean;
        objDigram.digramIndependentMean = ((objChar0.variance + char0MeanSquared) * (objChar1.variance + char1MeanSquared)) - (char0MeanSquared * char1MeanSquared);
        objDigram.digramIndependentVariance = ((objChar0.variance + char0MeanSquared) * (objChar1.variance + char1MeanSquared)) - (char0MeanSquared * char1MeanSquared);
        objDigram.differenceMean = objDigram.digramIndependentMean - objDigram.mean;
        objDigram.differenceVariance = objDigram.digramIndependentVariance + objDigram.variance;
        objDigram.z = objDigram.differenceMean / objDigram.differenceVariance;
      }
      const arrDigramResults = [];
      for (const objDigram of mapDigram.values()) {
//        if (objDigram.z > zThreshold) {
          arrDigramResults.push(objDigram);
//        }
      }
      return arrDigramResults;
    }
    function getTrigramResults(mapTrigram, mapDigram, mapUnigram) {
      for (const objTrigram of mapTrigram.values()) {
        const objPrefix = mapDigram.get(objTrigram.str[0] + objTrigram.str[1]);
        const objSuffix = mapUnigram.get(objTrigram.str[2]);
        if ((objPrefix.count < threshold) || (objSuffix.count < threshold) || (objDigram.count < threshold)) {
          objtrigram.z = 0;
          continue;
        }
        const prefixMeanSquared = objPrefix.mean * objPrefix.mean;
        const suffixMeanSquared = objSuffix.mean * objSuffix.mean;
        const trigramIndependentMean = ((objPrefix.variance + prefixMeanSquared) * (objSuffix.variance + suffixMeanSquared)) - (prefixMeanSquared * prefixMeanSquared);
        const trigramIndependentVariance = ((objPrefix.variance + prefixMeanSquared) * (objSuffix.variance + suffixMeanSquared)) - (suffixMeanSquared * suffixMeanSquared);
        const differenceMean = trigramIndependentMean - objTrigram.mean;
        const differenceVariance = trigramIndependentVariance + objTrigram.variance;
        objTrigram.z = differenceMean / differenceVariance;
      }
      const arrTrigramResults = [];
      for (const objTrigram of mapTrigram.values()) {
        if (objTrigram.z > zThreshold) {
          arrTrigramResults.push(objTrigram);
        }
      }
      return arrTrigramResults;
    }
    function getUnigramPrefixes(arrDigramResults) {
      const mapUnigramPrefix = new Map();
      for (const objDigram of arrDigramResults) {
        let obj = mapUnigramPrefix.get(objDigram.str[1]);
        if (!obj) {
          obj = {
            str: objDigram.str[1],
            prefixes: [],
          };
          mapUnigramPrefix.set(objDigram.str[1], obj);
        }
        obj.prefixes.push(objDigram.str[0]);
      }
      return Array.from(mapUnigramPrefix.values());
    }
    function getUnigramSuffixes(arrDigramResults) {
      const mapUnigramSuffix = new Map();
      for (const objDigram of arrDigramResults) {
        let obj = mapUnigramSuffix.get(objDigram.str[0]);
        if (!obj) {
          obj = {
            str: objDigram.str[0],
            suffixes: [],
          };
          mapUnigramSuffix.set(objDigram.str[0], obj);
        }
        obj.suffixes.push(objDigram.str[1]);
      }
      return Array.from(mapUnigramSuffix.values());
    }
    function addUnigramTable(display, arrUnigramResults) {
      const tableUnigrams = document.createElement("table");
      const trUnigramHeader = document.createElement("tr");
      const thUnigram = document.createElement("th");
      thUnigram.append("Unigram");
      trUnigramHeader.appendChild(thUnigram);
      const thUnigramRatio = document.createElement("th");
      thUnigramRatio.append("Ratio");
      trUnigramHeader.appendChild(thUnigramRatio);
      tableUnigrams.appendChild(trUnigramHeader);
      for (const item of arrUnigramResults) {
        const tr = document.createElement("tr");
        const tdUnigram = document.createElement("td");
        tdUnigram.append(strPresent(item.str));
        tr.appendChild(tdUnigram);
        const tdRatio = document.createElement("td");
        tdRatio.append(Math.round(item.ratio * 10000) / 100);
        tdRatio.append("%");
        tr.appendChild(tdRatio);
        tableUnigrams.appendChild(tr);
      }
      display.appendChild(tableUnigrams);
    }
    function addDigramTable(display, arrDigramResults) {
      const tableDigrams = document.createElement("table");
      const trDigramHeader = document.createElement("tr");
      const thDigram = document.createElement("th");
      thDigram.append("Digram");
      trDigramHeader.appendChild(thDigram);
      const thDigramChar1Ratio = document.createElement("th");
      thDigramChar1Ratio.append("Mean");
      trDigramHeader.appendChild(thDigramChar1Ratio);
      const thDigramChar2Ratio = document.createElement("th");
      thDigramChar2Ratio.append("Std Dev");
      trDigramHeader.appendChild(thDigramChar2Ratio);
      const thDigramRatio = document.createElement("th");
      thDigramRatio.append("z");
      trDigramHeader.appendChild(thDigramRatio);
      tableDigrams.appendChild(trDigramHeader);
      for (const item of arrDigramResults) {
        const tr = document.createElement("tr");
        const tdDigram = document.createElement("td");
        tdDigram.append(strPresent(item.str));
        tr.appendChild(tdDigram);
        const tdChar1Ratio = document.createElement("td");
        tdChar1Ratio.append(Math.round(item.mean * 10000) / 100);
        tdChar1Ratio.append("%");
        tr.appendChild(tdChar1Ratio);
        const tdChar2Ratio = document.createElement("td");
        tdChar2Ratio.append(Math.round(Math.sqrt(item.variance) * 10000) / 100);
        tdChar2Ratio.append("%");
        tr.appendChild(tdChar2Ratio);
        const tdDigramRatio = document.createElement("td");
        tdDigramRatio.append(Math.round(item.z * 100) / 100);
        tr.appendChild(tdDigramRatio);
        tableDigrams.appendChild(tr);
      }
      display.appendChild(tableDigrams);
    }
    function addTrigramTable(display, arrTrigramResults) {
      const tableTrigrams = document.createElement("table");
      const trTrigramHeader = document.createElement("tr");
      const thTrigram = document.createElement("th");
      thTrigram.append("Trigram");
      trTrigramHeader.appendChild(thTrigram);
      const thTrigramDigramRatio = document.createElement("th");
      thTrigramDigramRatio.append("mean");
      trTrigramHeader.appendChild(thTrigramDigramRatio);
      const thTrigramChar3Ratio = document.createElement("th");
      thTrigramChar3Ratio.append("Std Dev");
      trTrigramHeader.appendChild(thTrigramChar3Ratio);
      const thTrigramRatio = document.createElement("th");
      thTrigramRatio.append("z");
      trTrigramHeader.appendChild(thTrigramRatio);
      tableTrigrams.appendChild(trTrigramHeader);
      for (const item of arrTrigramResults) {
        const tr = document.createElement("tr");
        const tdTrigram = document.createElement("td");
        tdTrigram.append(strPresent(item.str));
        tr.appendChild(tdTrigram);
        const tdDigramRatio = document.createElement("td");
        tdDigramRatio.append(Math.round(item.mean * 10000) / 100);
        tdDigramRatio.append("%");
        tr.appendChild(tdDigramRatio);
        const tdChar3Ratio = document.createElement("td");
        tdChar3Ratio.append(Math.round(Math.sqrt(item.variance) * 10000) / 100);
        tdChar3Ratio.append("%");
        tr.appendChild(tdChar3Ratio);
        const tdTrigramRatio = document.createElement("td");
        tdTrigramRatio.append(Math.round(item.z * 100) / 100);
        tr.appendChild(tdTrigramRatio);
        tableTrigrams.appendChild(tr);
      }
      display.appendChild(tableTrigrams);
    }
    function addUnigramPrefixTable(arr, display) {
      arr.sort(function (a,b) {
        return (a.str.charCodeAt(0) < b.str.charCodeAt(0)) ? 1 : -1; 
      });
      const table = document.createElement("table");
      const trHeader = document.createElement("tr");
      const thUnigram = document.createElement("th");
      thUnigram.append("Unigram");
      thUnigram.style = "width:200px;";
      trHeader.appendChild(thUnigram);
      const thPrefixes = document.createElement("th");
      thPrefixes.append("Prefixes");
      trHeader.appendChild(thPrefixes);
      table.appendChild(trHeader);
      for (const item of arr) {
        console.log(item);
        const tr = document.createElement("tr");
        const tdUnigram = document.createElement("td");
        tdUnigram.append(strPresent(item.str));
        tr.appendChild(tdUnigram);
        const tdPrefixes = document.createElement("td");
        item.prefixes.sort();
        for (const prefix of item.prefixes) {
          tdPrefixes.append(strPresent(prefix) + " ");
        }
        tr.appendChild(tdPrefixes);
        table.appendChild(tr);
      }
      display.appendChild(table);
    }
    function addUnigramSuffixTable(arr, display) {
      const table = document.createElement("table");
      const trHeader = document.createElement("tr");
      const thUnigram = document.createElement("th");
      thUnigram.append("Unigram");
      thUnigram.style = "width:200px;";
      trHeader.appendChild(thUnigram);
      const thSuffixes = document.createElement("th");
      thSuffixes.append("Suffixes");
      trHeader.appendChild(thSuffixes);
      table.appendChild(trHeader);
      for (const item of arr) {
        console.log(item);
        const tr = document.createElement("tr");
        const tdUnigram = document.createElement("td");
        tdUnigram.append(strPresent(item.str));
        tr.appendChild(tdUnigram);
        const tdSuffixes = document.createElement("td");
        item.suffixes.sort();
        for (const suffix of item.suffixes) {
          tdSuffixes.append(strPresent(suffix) + " ");
        }
        tr.appendChild(tdSuffixes);
        table.appendChild(tr);
      }
      display.appendChild(table);
    }
  } catch (e) {
    console.error(e);
  }
}
