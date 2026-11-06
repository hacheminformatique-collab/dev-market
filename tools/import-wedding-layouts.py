"""Import safe editorial DOM from the supplied UTF-8 MHTML models."""
import email
import hashlib
import json
import re
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
TAGS = {'section', 'div', 'span', 'p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'br', 'button'}
ATTRS = {'id', 'style', 'href', 'target', 'rel', 'title'}


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = {'tag': 'root', 'children': []}
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
        self.stack[-1]['children'].append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index]['tag'] == tag:
                self.stack = self.stack[:index]
                break

    def handle_data(self, text):
        self.stack[-1]['children'].append(text)


def nodes(node):
    if isinstance(node, dict):
        yield node
        for child in node['children']:
            yield from nodes(child)


def text(node):
    return node if isinstance(node, str) else ''.join(text(child) for child in node['children'])


def clean(value):
    return re.sub(r'\s+', ' ', value).strip()


def city_pattern(label):
    parts = re.split(r'[-\s]+', label)
    def part_pattern(part):
        return ''.join('[eéèêë]' if c.lower() in 'eéèêë' else '[aàâä]' if c.lower() in 'aàâä'
                       else '[iîï]' if c.lower() in 'iîï' else '[oôö]' if c.lower() in 'oôö'
                       else '[uùûü]' if c.lower() in 'uùûü' else '[cç]' if c.lower() in 'cç' else re.escape(c)
                       for c in part)
    return re.compile(r'[-\s]+'.join(map(part_pattern, parts)), re.I)


def main(archive):
    models = json.loads((ROOT / 'src/data/weddingSourceModels.json').read_text())
    result = {}
    styles = []
    style_ids = {}
    with zipfile.ZipFile(archive) as zipped:
        entries = {}
        for filename in zipped.namelist():
            decoded = re.sub(r'#U([0-9a-fA-F]{4})', lambda m: chr(int(m[1], 16)), filename)
            entries[decoded] = filename
        for model in models:
            original = zipped.read(entries[model['sourceFile']])
            if hashlib.sha256(original).hexdigest() != model['sourceSha256']:
                raise ValueError(f"Source archive changed: {model['id']}")
            message = email.message_from_bytes(original)
            html = next(p.get_payload(decode=True).decode('utf-8') for p in message.walk()
                        if p.get_content_type() == 'text/html')
            parser = Parser()
            parser.feed(html)
            sections = {n['attrs']['id']: n for n in nodes(parser.root)
                        if n['tag'] == 'section' and n['attrs'].get('id')}
            editorial_ids = [section['id'] for section in model['sections']]
            if [section_id for section_id in sections if section_id in editorial_ids] != editorial_ids:
                raise ValueError(f"Source editorial section order changed: {model['id']}")
            replace_city = city_pattern(model['label'])
            def inject(value):
                value = replace_city.sub('xxxx', value)
                return re.sub(r'Hauts[-\s]+de[-\s]+Seine', 'yyyy', value, flags=re.I)
            def safe(node):
                if isinstance(node, str):
                    return inject(node)
                if node['tag'] not in TAGS:
                    raise ValueError(f"Unsupported editorial tag: {node['tag']}")
                attrs = {key: value for key, value in node['attrs'].items() if key in ATTRS}
                if 'style' in attrs and re.search(r'url\s*\(|expression|@import', attrs['style'], re.I):
                    raise ValueError('Unsafe source style')
                if 'style' in attrs:
                    style = attrs['style']
                    if style not in style_ids:
                        style_ids[style] = len(styles)
                        styles.append(style)
                    attrs['style'] = style_ids[style]
                if 'href' in attrs and not re.match(r'^(https?://|/|#|tel:|mailto:)', attrs['href']):
                    raise ValueError('Unsafe source URL')
                if 'href' in attrs:
                    attrs['href'] = re.sub(r'^http://localhost:5173(?=/)', '', attrs['href'])
                return {'tag': node['tag'], 'attrs': attrs, 'children': [safe(c) for c in node['children']]}
            layouts = []
            for section in model['sections']:
                tree = safe(sections[section['id']])
                if section['id'] != 'faq':
                    # Each legacy markdown block is associated with its original DOM element.
                    blocks = section['content'].split('\n\n')
                    available = list(nodes(tree))
                    for index, block in enumerate(blocks):
                        wanted = clean(re.sub(r'^#{2,3} ', '', block))
                        matches = [n for n in available if clean(text(n)).lstrip('✓').strip() == wanted]
                        if not matches:
                            raise ValueError(f"No source block {model['id']} {section['id']}: {wanted[:100]}")
                        match = matches[-1]
                        match['block'] = index
                        if clean(text(match)).startswith('✓'):
                            match['keepIcon'] = True
                        if all(isinstance(c, str) for c in match['children']):
                            raw = text(match)
                            prefix = re.match(r'^\s*', raw)[0]
                            suffix = re.search(r'\s*$', raw)[0]
                            if prefix:
                                match['prefix'] = prefix
                            if suffix:
                                match['suffix'] = suffix
                            match['children'] = []
                        available.remove(match)
                else:
                    questions = []
                    for button in [n for n in nodes(tree) if n['tag'] == 'button']:
                        question = clean(text(button['children'][0]))
                        parent = next(n for n in nodes(tree) if button in n['children'])
                        answer_nodes = [n for n in parent['children'] if n is not button]
                        answer = clean(''.join(text(n) for n in answer_nodes))
                        button['faq'] = {'question': question}
                        if answer:
                            button['faq']['answer'] = answer
                        questions.append(question)
                    if len(questions) != 14:
                        raise ValueError(f"Unexpected FAQ count for {model['id']}")
                def restored_text(node):
                    if isinstance(node, str):
                        return node
                    if 'block' in node and not node['children']:
                        return node.get('prefix', '') + re.sub(r'^#{2,3} ', '', section['content'].split('\n\n')[node['block']]) + node.get('suffix', '')
                    return ''.join(restored_text(c) for c in node['children'])
                if clean(restored_text(tree)) != clean(inject(text(sections[section['id']]))):
                    actual = clean(restored_text(tree))
                    expected = clean(inject(text(sections[section['id']])))
                    first = next((i for i, (a, b) in enumerate(zip(actual, expected)) if a != b), 0)
                    raise ValueError(f"Source DOM text changed: {model['id']} {section['id']}: {actual[first-40:first+80]!r} != {expected[first-40:first+80]!r}")
                layouts.append(tree)
            result[model['id']] = layouts
            print(model['id'], '8 sections, 14 FAQ questions; recovered answers:',
                  sum('answer' in n.get('faq', {}) for n in nodes(layouts[-1])))
    encoded = json.dumps({'styles': styles, 'models': result}, ensure_ascii=False, separators=(',', ':')) + '\n'
    output = ROOT / 'src/data/weddingSourceLayouts.json'
    if '--check' in sys.argv:
        if output.read_text() != encoded:
            raise ValueError('The committed source layout dataset differs from its MHTML originals.')
    else:
        output.write_text(encoded)


if __name__ == '__main__':
    main(sys.argv[1])
