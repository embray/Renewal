import collections
import dis
import functools
import itertools
import types


def patch_local_const(local_name, patch_func):
    """
    Decorator which patches the wrapped function so that just after a local
    variable name ``local_name`` is assigned to in the function, the given
    function ``patch_func``, which takes just the value of that local variable,
    is called and the return value replaces the local variable.

    The name derives from the fact that the given local variable is assumed to
    be "constant", i.e. its value is not changed throughout the function (its
    value may be mutable or immutable, however).

    In fact the variable may be overridden but then any effects of this
    patching are lost.

    Example
    -------
    >>> from patch_local import patch_local_const
    >>> @patch_local_const('A', lambda a: a + [5])
    ... def foo():
    ...     A = [1, 2, 3, 4]
    ...     print(A)
    ...
    >>> foo()
    [1, 2, 3, 4, 5]
    """

    plc = PatchLocalConst(local_name, patch_func)

    def wrapper(func):
        func = functools.wraps(func)(plc.patch(func))
        # Also make a note about the patches
        func.__patched_local__ = (local_name, patch_func)

    return wrapper


def flatten(list_of_lists):
    return itertools.chain.from_iterable(list_of_lists)


class _Instruction(collections.namedtuple('_Instruction',
        'offset, opcode, arg')):
    EXTENDED_ARG = dis.opmap['EXTENDED_ARG']

    def __repr__(self):
        ops = self._get_ops()
        max_offset = len(str(self.offset + self.n_bytes))
        max_opname = max(len(dis.opname[o[0]]) for o in ops)
        lines = []
        offset = self.offset
        for (opcode, arg) in ops:
            if self.arg is None:
                arg = ''
            opname = dis.opname[opcode]
            lines.append(f'{offset:>{max_offset}} {opname:<{max_opname}} {arg}')
            offset += 2
        return '\n'.join(lines)

    @property
    def n_bytes(self):
        return len(self.assemble())

    def _get_ops(self):
        """
        Return the list of real opcodes representing this instruction."""

        arglist = []
        arg = self.arg

        if arg is None:
            op = [(self.opcode, 0)]
        else:
            while arg > 0xff:
                arg = arg >> (8 * len(arglist))
                arglist.append((self.EXTENDED_ARG, arg & 0xff))

            arglist = arglist[::-1]
            if len(arglist) > 3:
                # No more than 3 EXTENDED_ARG opcodes can precede
                # an opcode
                raise RuntimeError(
                    f'argument {arg} for {dis.opname[opcode]} too large')

            if arglist:
                # The argument associated with the actual instruction
                # is the last one in the arglist
                arg = arglist.pop()[1]

            op = [(self.opcode, arg)]

        return arglist + op

    def assemble(self):
        if hasattr(self, '_code'):
            return self._code

        code = bytes(flatten(self._get_ops()))

        # cache on the instance for future calls
        self._code = code
        return code


class PatchLocalConst:
    def __init__(self, local_name, patch_func):
        self.local_name = local_name
        self.patch_func = patch_func

    # TODO: Instead of appending the patch function to the co_consts
    # we could make this more *dynamic* by adding a patched_locals
    # list in the co_consts, and then append to it.  That would allow
    # the same function to be patched multiple times.
    def patch(self, func):
        codeobj = func.__code__
        instructions = self._get_instructions(codeobj)
        thunk_idx, thunk_offset = self._find_thunk_offset(codeobj, instructions)
        thunk, thunk_length = self._make_thunk(codeobj, thunk_offset)
        instructions = (instructions[:thunk_idx] + thunk +
                        instructions[thunk_idx:])
        insertions = [(thunk_offset, thunk)]
        instructions = self._fixup_relocations(instructions, insertions)
        new_code = b''.join(instr.assemble() for instr in instructions)
        new_codeobj = types.CodeType(
            codeobj.co_argcount, codeobj.co_kwonlyargcount, codeobj.co_nlocals,
            codeobj.co_stacksize, codeobj.co_flags, new_code,
            codeobj.co_consts + (self.patch_func,), codeobj.co_names,
            codeobj.co_varnames, codeobj.co_filename, codeobj.co_name,
            codeobj.co_firstlineno, codeobj.co_lnotab)
        return types.FunctionType(new_codeobj, func.__globals__)

    @staticmethod
    def _get_instructions(codeobj):
        """
        Convert the `dis.Instruction` tuples into a simpler
        ``(offset, op, arg)`` tuple with built-in handling of EXTENDED_ARGs.
        """

        instructions = []
        n_extended_args = 0

        for instr in dis.get_instructions(codeobj):
            # Ignore EXTENDED_ARGS instructions as these will be treated
            # logically by the _Instruction class
            if instr.opname == 'EXTENDED_ARG':
                n_extended_args += 1
            else:
                offset = instr.offset - (2 * n_extended_args)
                instructions.append(_Instruction(offset, instr.opcode,
                                                 instr.arg))

        return instructions

    def _find_thunk_offset(self, codeobj, instructions):
        """
        Returns offset to just after the STORE_FAST opcode where the local
        constant's value is saved.

        This is where we will insert the thunk.
        """

        STORE_FAST = dis.opmap['STORE_FAST']
        var_idx = codeobj.co_varnames.index(self.local_name)

        for idx, instr in enumerate(instructions):
            if instr.opcode == STORE_FAST and instr.arg == var_idx:
                offset = instr.offset + instr.n_bytes
                return (idx + 1, offset)
        else:
            raise RuntimeError(
                f'no local variable by the name {self.local_name}')

    def _make_thunk(self, codeobj, offset):
        """
        Make the thunk code that will load the patch function and variable
        to replace on the stack, call the function, and store the variable's
        new value.
        """

        # Note: the patch_func is appended to the end of the original
        # function's co_consts
        var_idx = codeobj.co_varnames.index(self.local_name)
        func_const = len(codeobj.co_consts)
        total_size = 0

        def i(opname, arg):
            nonlocal offset, total_size
            instr = _Instruction(offset, dis.opmap[opname], arg)
            size = instr.n_bytes
            offset += size
            total_size += size
            return instr

        instructions = [
            i('LOAD_CONST', func_const),
            i('LOAD_FAST', var_idx),
            i('CALL_FUNCTION', 1),
            i('STORE_FAST', var_idx)
        ]

        return instructions, total_size

    @staticmethod
    def _fixup_relocations(instructions, insertions):
        # inspired by code found at
        # https://github.com/FXTD-ODYSSEY/vscode-mayapy/blob/7a21872f80b5b740fc653e79c3f9b5268e87b3c3/py/ptvsd/_vendored/pydevd/_pydevd_frame_eval/pydevd_modify_bytecode.py#L107
        # not guaranteed to be without bugs--need to try to come up with some
        # non-trivial examples for testing...
        jdx = 0

        while jdx < len(insertions):
            cur_offset, cur_insertion = insertions[jdx]
            cur_insertion_size = sum(i.n_bytes for i in cur_insertion)

            for idx, instr in enumerate(instructions[:]):
                offset, op, arg = instr

                if arg is not None:
                    if op in dis.hasjrel:
                        # The opcode jas a relative jump target
                        label = offset + 2 + arg
                        if offset < cur_offset < label:
                            # If our inserted code was after this jump
                            # instruction, then its relative address
                            # may have increased
                            arg += cur_insertion_size
                    elif op in dis.hasjabs:
                        # The opcode has an absolute jump target,
                        # so if it's beyond the current code insertion
                        # it needs to be updated
                        if cur_offset < arg:
                            arg += cur_insertion_size

                if offset > cur_offset:
                    offset += cur_insertion_size

                # Replace the original instruction with the new, updated
                # one
                new_instr = _Instruction(offset, op, arg)
                instructions[idx] = new_instr

                # If the new instruction is larger than the old one (i.e. its
                # argument size changed) then we most appended it to the list
                # of code insertions
                if new_instr.n_bytes > instr.n_bytes:
                    insertions.append((offset, [new_instr]))

            # We must also fix up the offsets in the insertions list
            for idx, insertion in enumerate(insertions[:]):
                offset, insert = insertion
                if offset > cur_offset:
                    insertions[idx] = (offset + cur_insertion_size, insert)

            jdx += 1

        return instructions
