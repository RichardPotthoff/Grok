
import re
import os
import sys
import json
from collections import defaultdict
from pprint import pprint as pp
import pathlib
def combine_patterns(*patterns):
  combined_pattern ='|'.join(f'(?P<pattern{i}>'+pattern[0]+')' for i,pattern in enumerate(patterns))
  return (re.compile(combined_pattern,flags=re.MULTILINE),patterns)

def combined_re_sub(content,combined_patterns):
  compiled_re,patterns=combined_patterns
  def callback(match):
    for key,group in match.groupdict().items():
      if group and key.startswith('pattern'):
        i=int(key[7:])
        return patterns[i][1](match)
  return compiled_re.sub(callback,content)

#regexes for common javascript patterns:
string_pattern = r"'(?:[^'\\]|\\.)*'|" + r'"(?:[^"\\]|\\.)*"|'
multiline_string_pattern = r'`(?:[^`\\]|\\.)*`'
comment_pattern = r'//.*?(?:\n|$)'#include the trailing newline
multiline_comment_pattern = r'/\*[\s\S]*?\*/'
delimiters=r'\[=({:<>;,?%&|*+-/' #removing ]}) from delimiters because of problems with asi not inserting semicolons if there is a \n behind the delimiter
whitespaces_to_right_of_delimiter =r'(?<=['+delimiters+r'])\s+'
whitespaces_to_left_of_delimiter =r'\s+(?=[]'+delimiters+'})'+r'])'
whitespaces_containing_newline=r'\s*\n\s*'
two_or_more_whitespaces = r'\s\s+'

combined_minify_patterns=combine_patterns(
    (string_pattern, lambda match:match.group()),           #detect strings, and put them back unminified
    (multiline_string_pattern, lambda match:match.group()), #detect strings, and put them back unminified
    (multiline_comment_pattern, lambda match:''),           #remove all comments 
    (comment_pattern, lambda match:''),                     #remove all comments
    (whitespaces_to_right_of_delimiter,lambda match:''),    #delete whitespaces if there is a delimiter to the left
    (whitespaces_to_left_of_delimiter,lambda match:''),     #delete whitespaces if there is a delimiter to the right
    (whitespaces_containing_newline,lambda match:'\n'),     #replace newline+whitespaces with a single newline
    (two_or_more_whitespaces,lambda match:' '),             #replace span of >=2 whitspaces with single whitespace
    )

minify_javascript=lambda code:combined_re_sub(code,combined_minify_patterns)      

import re

def basic_css_minifier(css_text):
    # 1. Remove all CSS comments /* ... */
    css_text = re.sub(r'/\*[\s\S]*?\*/', '', css_text)
    # 2. Remove whitespace around braces, colons, and semicolons
    css_text = re.sub(r'\s*([\{\};,])\s*', r'\1', css_text)
    # 3. Consolidate multiple spaces/newlines into a single space
    css_text = re.sub(r'\s+', ' ', css_text)
    return css_text.strip()


def add_exports(exportlist,exports):
  for item in exportlist.split(','):
    name,*alias=item.split('as')
    alias=alias[0] if alias else name
    exports[alias.strip()]=name.strip()
  return ''

def convert_es6_to_iife(content, module_filename=None, minify=False):
  imports={}
  import_pattern = r'(?=^|;)\s*(import\s+(?:(?:(?:(?P<default_import>\w+)(?:[,]|\s)\s*)?(?:(?P<import_group>\{[^}]*\}\s)|(?:\*\s+as\s+(?P<module_alias>\w+))\s)?)\s*from\s+)?[\'"](?P<module_path>[^"\']+)[\'"]\s*;?)'

  #The (?=^|;) Anchor Gotcha:Your import_pattern and export_pattern use (?=^|;)\s*. This assumes a statement always follows the start of a line or a semicolon.The Risk: If a statement follows a closing curly brace } from a block (like an if block or a prior function definition) without an explicit semicolon, the lookahead assertion will fail to match.The Fix (Optional): Changing it to (?=^|[;}\n])\s* or entirely omitting the lookahead since your string/comment guards are already doing the heavy lifting to prevent false positives inside literal blocks.
  #import_pattern = r'(?=^|[;}\n])\s*(import\s+(?:(?:(?:(?P<default_import>\w+)(?:[,]|\s)\s*)?(?:(?P<import_group>\{[^}]*\}\s)|(?:\*\s+as\s+(?P<module_alias>\w+))\s)?)\s*from\s+)?[\'"](?P<module_path>[^"\']+)[\'"]\s*;?)'
  #import_pattern = r'\s*(import\s+(?:(?:(?:(?P<default_import>\w+)(?:[,]|\s)\s*)?(?:(?P<import_group>\{[^}]*\}\s)|(?:\*\s+as\s+(?P<module_alias>\w+))\s)?)\s*from\s+)?[\'"](?P<module_path>[^"\']+)[\'"]\s*;?)'
  #Result: both did not work: the export statement changed 
  #from: global.modules["box.js"] = {default:{ render }} ;
  #to: global.modules["box.js"] = {default) ;
  #resulting in an error message: "Cannot use the keyword 'default' as a shorthand property name."

  
  def import_callback(match):
      groupdict=match.groupdict()
      default_import=groupdict['default_import'] # these are the named groups in the regular expression
      import_group=groupdict['import_group']
      module_alias=groupdict['module_alias']
      module_path=groupdict['module_path'].strip()
      module_filename=os.path.basename(module_path)
      imports[module_filename]=module_path
      result=[]
      if import_group:
        import_group=re.sub(r'(\w+)\s*as\s*(\w+)',r'\1 : \2',import_group.strip()) #replace 'as' with ':'
        result.append(f'let {import_group.strip()} = modules["{module_filename}"];')
      if module_alias:result.append(f'let {module_alias.strip()} = modules["{module_filename}"];')
      if default_import:result.append(f'let {default_import.strip()} = modules["{module_filename}"].default;')
      return '\n'.join(result)
      
  css_imports=set()
  loadCSS_pattern=r'\s*const\s*(?P<css_promise_name>\w+)\s*=\s*loadCSS\s*\(\s*[\'"](?P<css_path>[^"\']+)[\'"]\s*\)'
  def loadCSS_callback(match):
    groupdict=match.groupdict()
    css_path=groupdict['css_path']
    css_promise_name=groupdict['css_promise_name']
    css_imports.add(css_path)
    return f'const {css_promise_name} = Promise.resolve()'
    
  import_css_loader_pattern=r'\s*import\s*{\s*loadCSS\s*}\s*from\s*[\'"][^\'"]*[\'"];'

  css_from_line=re.compile(
      r"""loadCSS\s*\(\s*(?:new\s+URL\s*\(\s*['\"](?P<url>[^'\"]+)['\"]|['\"](?P<plain>[^'\"]+)['\"])"""
  )
  def exclude_iife_callback(match):
      line=match.groupdict()['exclude_iife']
      m=css_from_line.search(line)
      if m:
          css_imports.add(m.group('url') or m.group('plain'))
      return '// '+line + '\n'
  
  exports={}
  export_pattern = r'(?=^|;)\s*(export\s+(?P<export_default>default\s+)?(?P<export_type>(?:async\s+)?(?:function|const|let|var|class)(?:\s+|\s*\*\s*))?(?P<export_name>\w+)\s*)'
  #export_pattern = r'(?=^|[;}\n])\s*(export\s+(?P<export_default>default\s+)?(?P<export_type>(?:async\s+)?(?:function|const|let|var|class)(?:\s+|\s*\*\s*))?(?P<export_name>\w+)\s*)'
  #export_pattern = r'\s*(export\s+(?P<export_default>default\s+)?(?P<export_type>(?:async\s+)?(?:function|const|let|var|class)(?:\s+|\s*\*\s*))?(?P<export_name>\w+)\s*)'

  def export_callback(match):
      #print(match)
      groupdict=match.groupdict()
      export_type=groupdict['export_type']
      export_name=groupdict['export_name'].strip()
      exports[export_name]=export_name # possibly add alias syntax later
      if groupdict['export_default']:
        exports['default']=export_name;
      if export_type:
        # Keep a trailing space so `class Foo extends Bar` does not become `Fooextends`.
        return export_type+' '+export_name+' '
      else:
        return ''
        
      
  # here we are parsing for import and export patterns.
  # strings and comment patterns are detected simultaneously, thus preventing the detection of 
  # import/export patterns inside of strings and comments
  combined_es6_to_iife_patterns=combine_patterns(
      (string_pattern, lambda match:match.group()), #detect strings, and put them back unchanged
      (multiline_string_pattern, lambda match:match.group()),    #       
            # === NEW PREPROCESSOR RULES ===
      # 1. INCLUDE: Extract code from commented-out preprocessor directives
      (r'//\s*(?P<include_iife>.*//\s*@include-iife.*?)(?:\n|$)', lambda match: match.groupdict()['include_iife'] + '\n'),
      
      # 2. EXCLUDE: Erase lines targeted for exclusion
      (r'(^(?P<exclude_iife>.*//\s*@exclude-iife.*?)(?:\n|$))', exclude_iife_callback),
      # ==============================
      (comment_pattern, (lambda match:'') if minify else (lambda match:match.group())), #remove comments only if minify
      (multiline_comment_pattern, (lambda match:'') if minify else (lambda match:match.group())), #
      (import_css_loader_pattern,lambda match:''),#eliminate the loading of the 'loadCSS' function
      (loadCSS_pattern,loadCSS_callback),#collect 'loadCSS' style file imports
      (import_pattern,import_callback),#parse import statements, and replace them with equivalent let statements
      (r'(?=^|;)\s*(export\s+default\s+\{(?P<default_export_list>[^}]*)\}\s*;?)', lambda match: add_exports(f"{{{match.group('default_export_list')}}} as default",exports)), # ad-hoc pattern for default export of group " export default {f1, f2 as g, ...}; "
      (export_pattern,export_callback),#parse export statements, collect export names, remove 'export [default]'
      (r'(?=^|;)\s*(export\s+\{(?P<export_list>[^}]*)\}\s*;?)', lambda match:add_exports(match.group('export_list'), exports) ), # ad-hoc pattern for grouped exports: " export {f1, f2 as g, ...}; "
      )

  #the next line does all the work: the souce code is modified by the callback functions, and the
  #filenames and pathnames of the imported modules the and names of the exported symbols are collected 
  #in the 'imports' and 'exports' dictionaries. 
  content=combined_re_sub(content,combined_es6_to_iife_patterns)

  if exports:  # Only add the export object if there are exports
      iife_wrapper = f'\n(function(global) {{\n{content}\nif(!("modules" in global)){{\n global["modules"]={{}}\n}}\nglobal.modules["{module_filename}"] = {{{",".join((str(key)+":"+str(value) if value and (key!=value) else str(key)) for key,value in exports.items())}}} ;\n}})(window);'
  else:
      iife_wrapper = f'\n(function(global) {{\n{content}\n}})(window);'

  if minify:
      iife_wrapper = minify_javascript(iife_wrapper)

  return iife_wrapper,imports,css_imports

def gather_dependencies(content, processed_modules, dependencies, in_process=None, module_dir=None, module_filename=None, minify=False,open=open,import_map=None):
    if import_map==None:
      import_map=dict()
    if in_process==None:
      in_process=set()
    if module_filename:
      if module_filename in processed_modules:
        if module_filename in in_process:
          print(f'Circular dependency detected: Module "{module_filename}" is already being processed.')
        return "",set()
      else:
        in_process.add(module_filename)
        processed_modules.add(module_filename)

    # Process dependencies first
    print(f'Processing module "{module_filename if module_filename else "html <script>"}"')
        # Convert the module itself 
    converted,imports,css_imports = convert_es6_to_iife(content, module_filename, minify=minify)
    dependency_content = ""
    css_importlist=set()
    for ifile_name,ifile_path in imports.items():
        ifile_path=import_map.get(ifile_path,ifile_path)
        dependencies[module_filename].add(ifile_name)
        #full_path = os.path.join(os.path.abspath(module_dir), ifile_path)
        full_path=pathlib.Path(module_dir)/ifile_path
#        print(f'{full_path = }')
        imodule_dir=os.path.dirname(full_path)
        try:
          with open(full_path, 'r',encoding='utf-8') as f:
             content = f.read()
        except Exception as e:
          print(f'{module_dir=}\n{module_filename=}\n{ifile_name=}\n{ifile_path=}\n{full_path=}\n{imodule_dir=}\n',file=sys.stderr)
          raise e
        i_content, i_css_files= gather_dependencies(content, processed_modules, dependencies,in_process,module_dir=imodule_dir,module_filename=ifile_name, minify=minify,open=open,import_map=import_map)
        css_importlist|=i_css_files 
        dependency_content+=i_content
    if module_filename:
      in_process.remove(module_filename)
    #print(f'{module_dir=} {module_filename=} {css_imports=}')
    return dependency_content + converted, css_importlist|set(pathlib.Path(module_dir)/css for css in css_imports)

def convertES6toIIFE(content="import from './main.js';",module_dir='',module_filename='',minify=True,open=open,import_map=None):
  processed_modules = set()
  dependencies = defaultdict(set)
  iife_content,css_imports = gather_dependencies(content, processed_modules, dependencies,  
                module_dir=module_dir, module_filename=module_filename,  minify=minify,open=open,import_map=import_map)
  return iife_content,css_imports

  
def process_html(html_path,minify=False,output_file='output.html',open=open):
    from bs4 import BeautifulSoup
    with open(html_path, 'r',encoding='utf-8') as file:
        soup = BeautifulSoup(file.read(), 'html.parser')
    try:
        importmap_script = soup.find('script', {'type': 'importmap'})
        import_map = json.loads(importmap_script.string)
        importmap_script.decompose()
        import_map = import_map.get('imports', {})
        print(f'{import_map=}')
    except Exception as e:
        print(f'No import map found in {html_path}. Continuing ...')
        import_map=dict()
    processed_modules = set()
    css_import_list=set()
    dependencies = defaultdict(set)
    if minify:
        for style in soup.find_all('style'):
            minified_style=basic_css_minifier(style.get_text())
            style.clear()
            style.append(minified_style)
    for script in soup.find_all('script'):
        if script.get('type') == 'module':
            module_path = script.get('src',None)
            if module_path!=None:
                #full_path = os.path.join(os.path.dirname(html_path), module_path)
                full_path = pathlib.Path(html_path).parent/module_path
                #print(f'{html_path=} {module_path=} {full_path=} ')
                module_dir = os.path.dirname(full_path)
                module_filename = os.path.basename(full_path)
                # Gather all dependencies for this module
                with open(full_path, 'r',encoding='utf-8') as f:
                    content = f.read()
                del script['src']  # Remove the src attribute as we've included the content
            else:
                content=script.string
                #module_filename=None
                module_filename=script.get('name')
                module_dir=os.path.dirname(html_path)
            script['type'] = 'text/javascript'  # Change type to standard JavaScript
            # Insert the converted IIFE content for this module and its dependencies
            iife_content,css_imports = gather_dependencies(content, processed_modules, dependencies,  
                module_dir=module_dir, module_filename=module_filename,  minify=minify,open=open,import_map=import_map)
            css_import_list|=css_imports
            script.string = iife_content
        else:
            # For regular scripts, insert their content
            script_path = script.get('src',None)
            if script_path:
               with open(os.path.join(os.path.dirname(html_path), script['src']), 'r',encoding='utf-8') as f:
                   if minify:
                     script.string = minify_javascript(f.read())
                   else:
                     script.string = f.read()
               del script['src']
            else:
                if minify:
                   script.string=minify_javascript(script.string)
    if not soup.head:
       soup.insert(0, soup.new_tag("head"))
    style_tag=soup.head.find("style")
    if not style_tag:
      style_tag=soup.new_tag("style")
      soup.head.append(style_tag)
    style_tag.append("\n/* --- Bundled Dynamic Styles --- */\n")
    for css_file_path in css_import_list:
       #print(f'{css_file_path=} {css_file_path.is_file()=}') 
       if css_file_path.is_file():
           with open(css_file_path,'r',encoding="utf-8") as f:
             new_style=f.read().strip()
             if new_style:
               if minify:
                 style_tag.append(basic_css_minifier('\n'+style+'\n'))
               else:
                 style_tag.append(f"\n/* From: {css_file_path} */\n{new_style}\n")
       else:
         print(f"Warning: {css_file_path} not found, skipping.",file=sys.stderr)
    if output_file:
        with open(output_file, 'w',encoding="utf-8") as file:
           file.write(str(soup))
    else:
        return str(soup)

if __name__ == "__main__":
#    module_filename='index.js'
#    print(convert_es6_to_iife(open(module_filename).read(),module_filename=module_filename,minify=False)[0])
#    raise Exception
    from time import perf_counter
    t1=perf_counter()
  
    html_file = "cutter_anyui.html"
    output_file='index_anyui.html'
    print(f'ES6 to IIFE convertersion of{html_file} started.')
    print(f'root directory: {os.getcwd()}')
    process_html(html_file,minify=False,output_file=output_file)
    print(f"{html_file}(ES6)  -> {output_file}(iife) conversion completed.")
    t2=perf_counter()
    print(f'{t2-t1=}')

'''    
    os.chdir("/private/var/mobile/Containers/Data/Application/77881549-3FA6-4E4B-803F-D53B172FC865/Documents/www")
    html_file = "webgl-3d-camera-look-at-heads.html"
    process_html(html_file,minify=True)
    print("HTML processing completed with modules converted to IIFE.")
'''
