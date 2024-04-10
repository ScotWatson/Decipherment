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
    const BODY = Interface.createBodyObject({});
    const mainLayout = BODY.createAttached({
      objectId: Interface.OBJECT_LAYOUT,
      parameters: {
        layoutId: LAYOUT_HEADER,
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
    function readFile() {
      const file = Interface.modalSingleFile({});
      if (file !== null) {
        interpretFile(file);
      }
    }
    async function interpretFile(file) {
      const text = await file.text();
      const display = mainLayout.createAttached({
        area: "body",
        objectId: Interface.OBJECT_HTML,
        parameters: {
          text: "Select File",
        },
      });
      const mapUnigram = countUnigrams(text);
      const arrUnigramResults = getUnigramResults(mapUnigram, text.length);
      arrUnigramResults.sort(function (a, b) {
        return (a.ratio < b.ratio) ? 1 : -1;
      });
      console.log(arrUnigramResults);
      addUnigramTable(display);
      const mapDigram = countNgrams(text, 2);
      const mapTrigram = countNgrams(text, 3);
      const arrDigramResults = getDigramResults(mapDigram, mapUnigram, text.length);
      const arrUnigramPrefixes = getUnigramPrefixes(arrDigramResults);
      addUnigramPrefixTable(arrUnigramPrefixes, display);
      const arrUnigramSuffixes = getUnigramSuffixes(arrDigramResults);
      addUnigramSuffixTable(arrUnigramSuffixes, display);
      arrDigramResults.sort(function (a, b) {
        const strength_a = a.digramRatio / a.char2ratio;
        const strength_b = b.digramRatio / b.char2ratio;
        return (strength_a < strength_b) ? 1 : -1;
      });
      console.log(arrDigramResults);
      addDigramTable(display);
      const arrTrigramResults = getTrigramResults(mapTrigram, mapDigram, mapUnigram, text.length);
      arrTrigramResults.sort(function (a, b) {
        const strength_a = a.trigramRatio / a.char3ratio;
        const strength_b = b.trigramRatio / b.char3ratio;
        return (strength_a < strength_b) ? 1 : -1;
      });
      console.log(arrTrigramResults);
      addTrigramTable(display);
      console.log("done");
    }
    const threshold = 5;
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
    function addUnigramTable(display) {
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
    function addDigramTable(display) {
      const tableDigrams = document.createElement("table");
      const trDigramHeader = document.createElement("tr");
      const thDigram = document.createElement("th");
      thDigram.append("Digram");
      trDigramHeader.appendChild(thDigram);
      const thDigramChar1Ratio = document.createElement("th");
      thDigramChar1Ratio.append("Char1 Ratio");
      trDigramHeader.appendChild(thDigramChar1Ratio);
      const thDigramChar2Ratio = document.createElement("th");
      thDigramChar2Ratio.append("Char2 Ratio");
      trDigramHeader.appendChild(thDigramChar2Ratio);
      const thDigramRatio = document.createElement("th");
      thDigramRatio.append("Digram Ratio");
      trDigramHeader.appendChild(thDigramRatio);
      tableDigrams.appendChild(trDigramHeader);
      for (const item of arrDigramResults) {
        const tr = document.createElement("tr");
        const tdDigram = document.createElement("td");
        tdDigram.append(strPresent(item.str));
        tr.appendChild(tdDigram);
        const tdChar1Ratio = document.createElement("td");
        tdChar1Ratio.append(Math.round(item.char1ratio * 10000) / 100);
        tdChar1Ratio.append("%");
        tr.appendChild(tdChar1Ratio);
        const tdChar2Ratio = document.createElement("td");
        tdChar2Ratio.append(Math.round(item.char2ratio * 10000) / 100);
        tdChar2Ratio.append("%");
        tr.appendChild(tdChar2Ratio);
        const tdDigramRatio = document.createElement("td");
        tdDigramRatio.append(Math.round(item.digramRatio * 10000) / 100);
        tdDigramRatio.append("%");
        tr.appendChild(tdDigramRatio);
        tableDigrams.appendChild(tr);
      }
      display.appendChild(tableDigrams);
    }
    function addTrigramTable(display) {
      const tableTrigrams = document.createElement("table");
      const trTrigramHeader = document.createElement("tr");
      const thTrigram = document.createElement("th");
      thTrigram.append("Trigram");
      trTrigramHeader.appendChild(thTrigram);
      const thTrigramDigramRatio = document.createElement("th");
      thTrigramDigramRatio.append("Digram Ratio");
      trTrigramHeader.appendChild(thTrigramDigramRatio);
      const thTrigramChar3Ratio = document.createElement("th");
      thTrigramChar3Ratio.append("Char 3 Ratio");
      trTrigramHeader.appendChild(thTrigramChar3Ratio);
      const thTrigramRatio = document.createElement("th");
      thTrigramRatio.append("Trigram Ratio");
      trTrigramHeader.appendChild(thTrigramRatio);
      tableTrigrams.appendChild(trTrigramHeader);
      for (const item of arrTrigramResults) {
        const tr = document.createElement("tr");
        const tdTrigram = document.createElement("td");
        tdTrigram.append(strPresent(item.str));
        tr.appendChild(tdTrigram);
        const tdDigramRatio = document.createElement("td");
        tdDigramRatio.append(Math.round(item.digramRatio * 10000) / 100);
        tdDigramRatio.append("%");
        tr.appendChild(tdDigramRatio);
        const tdChar3Ratio = document.createElement("td");
        tdChar3Ratio.append(Math.round(item.char3ratio * 10000) / 100);
        tdChar3Ratio.append("%");
        tr.appendChild(tdChar3Ratio);
        const tdTrigramRatio = document.createElement("td");
        tdTrigramRatio.append(Math.round(item.trigramRatio * 10000) / 100);
        tdTrigramRatio.append("%");
        tr.appendChild(tdTrigramRatio);
        tableTrigrams.appendChild(tr);
      }
      display.appendChild(tableTrigrams);
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
      let buffer = "".padEnd(n, " ");
      for (const char of text) {
        buffer = buffer.substring(1) + char;
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
      return mapNgram;
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
    function getDigramResults(mapDigram, mapUnigram, textLength) {
      const arrDigramResults = [];
      for (const entry of mapDigram.entries()) {
        const objCount = entry[1];
        if (objCount.count < threshold) {
          // counts this low are unreliable
          continue;
        }
        const objResult = {
          str: objCount.str,
        };
        const char1 = objCount.str[0];
        const char2 = objCount.str[1];
        objResult.char1ratio = mapUnigram.get(char1).count / textLength;
        objResult.char2ratio = mapUnigram.get(char2).count / textLength;
        objResult.digramRatio = objCount.count / mapUnigram.get(char1).count;
        if (objResult.digramRatio >= objResult.char2ratio) {
          arrDigramResults.push(objResult);
        }
      }
      return arrDigramResults;
    }
    function getTrigramResults(mapTrigram, mapDigram, mapUnigram, textLength) {
      const arrTrigramResults = [];
      for (const entry of mapTrigram.entries()) {
        const objCount = entry[1];
        if (objCount.count < threshold) {
          // counts this low are unreliable
          continue;
        }
        const objResult = {
          str: objCount.str,
        };
        const char1 = objCount.str[0];
        const char2 = objCount.str[1];
        const char3 = objCount.str[2];
        objResult.digramRatio = mapDigram.get(char1 + char2).count / textLength;
        objResult.char3ratio = mapUnigram.get(char3).count / textLength;
        objResult.trigramRatio = objCount.count / mapDigram.get(char1 + char2).count;
        if (objResult.trigramRatio >= objResult.char3ratio) {
          arrTrigramResults.push(objResult);
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
  }
}
